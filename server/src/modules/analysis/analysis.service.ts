import type { SyncTrigger } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../common/errors/AppError.ts";
import { callAiService } from "../../infra/aiService/aiServiceClient.ts";
import { DEFAULT_AI_PROVIDER_CONFIG, resolveAiProviderConfig } from "../../infra/aiService/providerConfig.ts";
import { getInstallationAccessToken } from "../../infra/github/octokitApp.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { publishToQueue } from "../../infra/rabbitmq/publisher.ts";
import { githubRepository } from "../github/github.repository.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { userRepository } from "../user/user.repository.ts";
import { analysisRepository } from "./analysis.repository.ts";
import type {
  AiAnalysisResult,
  AnalysisJobPayload,
  FindingResponseDto,
  ListFindingsQuery,
  ListHistoryQuery,
  PageInfo,
  RepositoryAnalysisResponseDto,
} from "./analysis.types.ts";

function toAnalysisDto(analysis: {
  id: string;
  status: RepositoryAnalysisResponseDto["status"];
  overallScore: number | null;
  architectureScore: number | null;
  securityScore: number | null;
  performanceScore: number | null;
  maintainabilityScore: number | null;
  scalabilityScore: number | null;
  modularityScore: number | null;
  layeringScore: number | null;
  documentationScore: number | null;
  complexityScore: number | null;
  technicalDebtScore: number | null;
  architectureSummary: string | null;
  retryCount: number;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}): RepositoryAnalysisResponseDto {
  return {
    id: analysis.id,
    status: analysis.status,
    overallScore: analysis.overallScore,
    architectureScore: analysis.architectureScore,
    securityScore: analysis.securityScore,
    performanceScore: analysis.performanceScore,
    maintainabilityScore: analysis.maintainabilityScore,
    scalabilityScore: analysis.scalabilityScore,
    modularityScore: analysis.modularityScore,
    layeringScore: analysis.layeringScore,
    documentationScore: analysis.documentationScore,
    complexityScore: analysis.complexityScore,
    technicalDebtScore: analysis.technicalDebtScore,
    architectureSummary: analysis.architectureSummary,
    retryCount: analysis.retryCount,
    startedAt: analysis.startedAt,
    completedAt: analysis.completedAt,
    errorMessage: analysis.errorMessage,
  };
}

function toFindingDto(finding: {
  id: string;
  category: string;
  type: string;
  severity: string;
  priority: string | null;
  title: string;
  explanation: string;
  evidence: string | null;
  suggestedFix: string | null;
  estimatedImpact: string | null;
  confidence: number;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  symbolId: string | null;
  relatedFiles: string[];
  relatedClasses: string[];
  relatedFunctions: string[];
  metadata: unknown;
}): FindingResponseDto {
  return {
    id: finding.id,
    category: finding.category,
    type: finding.type,
    severity: finding.severity,
    priority: finding.priority,
    title: finding.title,
    explanation: finding.explanation,
    evidence: finding.evidence,
    suggestedFix: finding.suggestedFix,
    estimatedImpact: finding.estimatedImpact,
    confidence: finding.confidence,
    filePath: finding.filePath,
    startLine: finding.startLine,
    endLine: finding.endLine,
    symbolId: finding.symbolId,
    relatedFiles: finding.relatedFiles,
    relatedClasses: finding.relatedClasses,
    relatedFunctions: finding.relatedFunctions,
    metadata: finding.metadata,
  };
}

function toPageInfo(page: number, pageSize: number, totalCount: number): PageInfo {
  return { page, pageSize, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) };
}

export const analysisService = {
  async enqueueAnalysis(repositoryId: string, trigger: SyncTrigger, triggeredById: string | null): Promise<void> {
    const activeCount = await analysisRepository.countActiveStatuses(repositoryId);
    if (activeCount > 0) {
      throw new ConflictError("This repository is already being analyzed");
    }

    const analysis = await analysisRepository.create(repositoryId, trigger, triggeredById, null);
    const payload: AnalysisJobPayload = { analysisId: analysis.id, repositoryId };
    await publishToQueue(QUEUES.REPOSITORY_ANALYZE, payload);
  },

  async retryAnalysis(repositoryId: string, analysisId: string): Promise<void> {
    const analysis = await analysisRepository.findById(analysisId);
    if (!analysis || analysis.repositoryId !== repositoryId) {
      throw new NotFoundError(`Analysis ${analysisId} not found for this repository`);
    }
    if (analysis.status !== "FAILED") {
      throw new ConflictError("Only a failed analysis can be retried");
    }

    await analysisRepository.markRetryRequested(analysisId);
    const payload: AnalysisJobPayload = { analysisId, repositoryId };
    await publishToQueue(QUEUES.REPOSITORY_ANALYZE, payload);
  },

  async cancelAnalysis(repositoryId: string, analysisId: string): Promise<void> {
    const analysis = await analysisRepository.findById(analysisId);
    if (!analysis || analysis.repositoryId !== repositoryId) {
      throw new NotFoundError(`Analysis ${analysisId} not found for this repository`);
    }
    if (analysis.status !== "PENDING" && analysis.status !== "RUNNING") {
      throw new ConflictError("Only a pending or running analysis can be cancelled");
    }

    // Soft cancel: there's no cheap way to abort the in-flight FastAPI call,
    // so we mark the row CANCELLED now and performAnalysis re-checks the
    // status before persisting a result that arrives after cancellation.
    await analysisRepository.markCancelled(analysisId);
  },

  async performAnalysis(repositoryId: string, analysisId: string): Promise<void> {
    const repo = await repoRepository.findById(repositoryId);
    if (!repo) {
      throw new NotFoundError(`Repository ${repositoryId} not found`);
    }

    const installation = await githubRepository.findByOrganizationId(repo.organizationId);
    if (!installation) {
      throw new ConflictError("GitHub is not connected for this organization");
    }

    // Attribute the AI provider choice to whoever triggered this analysis run -
    // auto-triggered runs (webhook sync, no human in the loop) have no
    // triggeredById, so they fall back to the server's default provider/key.
    const analysis = await analysisRepository.findById(analysisId);
    const triggeredByUser = analysis?.triggeredById ? await userRepository.findById(analysis.triggeredById) : null;
    const providerConfig = triggeredByUser ? resolveAiProviderConfig(triggeredByUser) : DEFAULT_AI_PROVIDER_CONFIG;

    await analysisRepository.markRunning(analysisId);

    const accessToken = await getInstallationAccessToken(Number(installation.githubInstallationId));

    const result = await callAiService<AiAnalysisResult>("/internal/analyze", {
      body: {
        organization_id: repo.organizationId,
        repository_id: repo.id,
        clone_url: repo.cloneUrl,
        access_token: accessToken,
        default_branch: repo.defaultBranch,
        provider: providerConfig.provider.toLowerCase(),
        api_key: providerConfig.apiKey,
      },
    });

    const current = await analysisRepository.findById(analysisId);
    if (current?.status === "CANCELLED") {
      return;
    }

    await analysisRepository.complete(analysisId, result);
  },

  async getLatestStatus(repositoryId: string): Promise<RepositoryAnalysisResponseDto | null> {
    const analysis = await analysisRepository.findLatestAny(repositoryId);
    return analysis ? toAnalysisDto(analysis) : null;
  },

  async getLatestCompleted(repositoryId: string): Promise<RepositoryAnalysisResponseDto | null> {
    const analysis = await analysisRepository.findLatestByRepository(repositoryId);
    return analysis ? toAnalysisDto(analysis) : null;
  },

  async listHistory(
    repositoryId: string,
    query: ListHistoryQuery,
  ): Promise<{ items: RepositoryAnalysisResponseDto[]; pageInfo: PageInfo }> {
    const { items, totalCount } = await analysisRepository.listHistory(repositoryId, query);
    return { items: items.map(toAnalysisDto), pageInfo: toPageInfo(query.page, query.pageSize, totalCount) };
  },

  async getTrend(repositoryId: string, limit: number): Promise<RepositoryAnalysisResponseDto[]> {
    const { items } = await analysisRepository.listHistory(repositoryId, { page: 1, pageSize: limit });
    return items.map(toAnalysisDto).reverse();
  },

  async listFindings(
    repositoryId: string,
    query: ListFindingsQuery,
  ): Promise<{ items: FindingResponseDto[]; pageInfo: PageInfo }> {
    const latest = await analysisRepository.findLatestByRepository(repositoryId);
    if (!latest) {
      return { items: [], pageInfo: toPageInfo(query.page, query.pageSize, 0) };
    }
    const { items, totalCount } = await analysisRepository.listFindings(latest.id, query);
    return { items: items.map(toFindingDto), pageInfo: toPageInfo(query.page, query.pageSize, totalCount) };
  },
};
