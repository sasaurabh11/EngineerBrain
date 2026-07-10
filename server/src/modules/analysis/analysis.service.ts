import type { FindingCategory, FindingSeverity, SyncTrigger } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../common/errors/AppError.ts";
import { callAiService } from "../../infra/aiService/aiServiceClient.ts";
import { getInstallationAccessToken } from "../../infra/github/octokitApp.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { publishToQueue } from "../../infra/rabbitmq/publisher.ts";
import { githubRepository } from "../github/github.repository.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { analysisRepository } from "./analysis.repository.ts";
import type { AiAnalysisResult, AnalysisJobPayload, FindingResponseDto, RepositoryAnalysisResponseDto } from "./analysis.types.ts";

function toAnalysisDto(analysis: {
  id: string;
  status: RepositoryAnalysisResponseDto["status"];
  overallScore: number | null;
  architectureScore: number | null;
  securityScore: number | null;
  performanceScore: number | null;
  maintainabilityScore: number | null;
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
  title: string;
  explanation: string;
  suggestedFix: string | null;
  confidence: number;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  symbolId: string | null;
  metadata: unknown;
}): FindingResponseDto {
  return {
    id: finding.id,
    category: finding.category,
    type: finding.type,
    severity: finding.severity,
    title: finding.title,
    explanation: finding.explanation,
    suggestedFix: finding.suggestedFix,
    confidence: finding.confidence,
    filePath: finding.filePath,
    startLine: finding.startLine,
    endLine: finding.endLine,
    symbolId: finding.symbolId,
    metadata: finding.metadata,
  };
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

  async performAnalysis(repositoryId: string, analysisId: string): Promise<void> {
    const repo = await repoRepository.findById(repositoryId);
    if (!repo) {
      throw new NotFoundError(`Repository ${repositoryId} not found`);
    }

    const installation = await githubRepository.findByOrganizationId(repo.organizationId);
    if (!installation) {
      throw new ConflictError("GitHub is not connected for this organization");
    }

    await analysisRepository.markRunning(analysisId);

    const accessToken = await getInstallationAccessToken(Number(installation.githubInstallationId));

    const result = await callAiService<AiAnalysisResult>("/internal/analyze", {
      body: {
        organization_id: repo.organizationId,
        repository_id: repo.id,
        clone_url: repo.cloneUrl,
        access_token: accessToken,
        default_branch: repo.defaultBranch,
      },
    });

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

  async listHistory(repositoryId: string, limit = 20): Promise<RepositoryAnalysisResponseDto[]> {
    const history = await analysisRepository.listHistory(repositoryId, limit);
    return history.map(toAnalysisDto);
  },

  async listFindings(repositoryId: string, category?: FindingCategory, severity?: FindingSeverity): Promise<FindingResponseDto[]> {
    const latest = await analysisRepository.findLatestByRepository(repositoryId);
    if (!latest) {
      return [];
    }
    const findings = await analysisRepository.listFindings(latest.id, category, severity);
    return findings.map(toFindingDto);
  },
};
