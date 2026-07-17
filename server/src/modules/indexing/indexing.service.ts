import type { SyncTrigger } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../common/errors/AppError.ts";
import { callAiService } from "../../infra/aiService/aiServiceClient.ts";
import { getInstallationAccessToken } from "../../infra/github/octokitApp.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { publishToQueue } from "../../infra/rabbitmq/publisher.ts";
import { analysisService } from "../analysis/analysis.service.ts";
import { findAndReadSymbol } from "../ai/tools/shared.ts";
import { githubRepository } from "../github/github.repository.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { indexingRepository } from "./indexing.repository.ts";
import type {
  ApiEndpointResponseDto,
  AiIndexResult,
  CodeGraphEdgeResponseDto,
  CodeSymbolResponseDto,
  DependentEntry,
  IndexJobPayload,
  RepositoryFileResponseDto,
  RepositoryIndexResponseDto,
  SymbolSourceResult,
} from "./indexing.types.ts";

export const indexingService = {
  async enqueueIndex(
    repositoryId: string,
    trigger: SyncTrigger,
    triggeredById: string | null,
    forceFull = false,
  ): Promise<void> {
    const existingIndex = await indexingRepository.getIndex(repositoryId);
    if (existingIndex?.status === "INDEXING") {
      throw new ConflictError("This repository is already being indexed");
    }

    await indexingRepository.getOrCreateIndex(repositoryId);
    const job = await indexingRepository.createJob(repositoryId, trigger, triggeredById);
    await indexingRepository.updateIndexStatus(repositoryId, "PENDING");

    const payload: IndexJobPayload = { indexingJobId: job.id, repositoryId, forceFull };
    await publishToQueue(QUEUES.REPOSITORY_INDEX, payload);
  },

  async performIndex(repositoryId: string, jobId: string, forceFull: boolean): Promise<void> {
    const repo = await repoRepository.findById(repositoryId);
    if (!repo) {
      throw new NotFoundError(`Repository ${repositoryId} not found`);
    }

    const installation = await githubRepository.findByOrganizationId(repo.organizationId);
    if (!installation) {
      throw new ConflictError("GitHub is not connected for this organization");
    }

    await indexingRepository.updateIndexStatus(repositoryId, "INDEXING");

    const accessToken = await getInstallationAccessToken(Number(installation.githubInstallationId));
    const previousFiles = forceFull ? [] : await indexingRepository.listPreviousFiles(repositoryId);

    const result = await callAiService<AiIndexResult>("/internal/index", {
      body: {
        organization_id: repo.organizationId,
        repository_id: repo.id,
        clone_url: repo.cloneUrl,
        access_token: accessToken,
        default_branch: repo.defaultBranch,
        previous_files: previousFiles.map((f) => ({ path: f.path, content_hash: f.contentHash })),
      },
    });

    await indexingRepository.persistIndexResult(repositoryId, result);
    await indexingRepository.updateIndexStatus(repositoryId, "INDEXED", {
      lastIndexedCommitSha: result.new_commit_sha,
      detectedFrameworks: result.detected_frameworks,
    });
    await indexingRepository.markJobSuccess(jobId, result.files_processed);

    // Chain straight into analysis so a freshly indexed repo gets a health
    // report with no manual step. "SCHEDULED" marks this as system-triggered
    // rather than a direct user click.
    try {
      await analysisService.enqueueAnalysis(repositoryId, "SCHEDULED", null);
    } catch (err) {
      if (!(err instanceof ConflictError)) {
        throw err;
      }
    }
  },

  async getStatus(repositoryId: string): Promise<RepositoryIndexResponseDto> {
    const index = await indexingRepository.getIndex(repositoryId);
    const [totalFiles, totalSymbols, totalChunks] = await indexingRepository.countAggregates(repositoryId);

    return {
      status: index?.status ?? "PENDING",
      lastIndexedAt: index?.lastIndexedAt ?? null,
      detectedFrameworks: index?.detectedFrameworks ?? [],
      totalFiles,
      totalSymbols,
      totalChunks,
    };
  },

  async listFiles(repositoryId: string): Promise<RepositoryFileResponseDto[]> {
    const files = await indexingRepository.listFiles(repositoryId);
    return files.map((f) => ({
      id: f.id,
      path: f.path,
      language: f.language,
      sizeBytes: f.sizeBytes,
      linesOfCode: f.linesOfCode,
    }));
  },

  async listSymbols(repositoryId: string, kinds: string[]): Promise<CodeSymbolResponseDto[]> {
    const symbols = await indexingRepository.listSymbolsByKind(repositoryId, kinds);
    return symbols.map((s) => ({
      id: s.id,
      kind: s.kind,
      name: s.name,
      filePath: s.file.path,
      startLine: s.startLine,
      endLine: s.endLine,
      signature: s.signature,
      docComment: s.docComment,
      parentSymbolId: s.parentSymbolId,
    }));
  },

  async findSymbolSource(
    organizationId: string,
    repositoryId: string,
    userId: string,
    name: string,
    kind?: "class" | "function",
  ): Promise<SymbolSourceResult> {
    const repo = await repoRepository.findByOrgAndId(organizationId, repositoryId);
    if (!repo) {
      throw new NotFoundError("Repository not found");
    }

    const kinds = kind === "class" ? ["CLASS", "INTERFACE"] : kind === "function" ? ["FUNCTION", "METHOD"] : ["CLASS", "INTERFACE", "FUNCTION", "METHOD"];

    return findAndReadSymbol({ organizationId, userId, repositoryId }, { name, repository_id: repositoryId }, kinds);
  },

  async findDependentsForFiles(repositoryId: string, filePaths: string[]): Promise<DependentEntry[]> {
    const files = await indexingRepository.findFilesByPaths(repositoryId, filePaths);
    if (files.length === 0) {
      return [];
    }

    const pathByFileId = new Map(files.map((f) => [f.id, f.path]));
    const edges = await indexingRepository.findDependents(repositoryId, files.map((f) => f.id));

    const entries: DependentEntry[] = [];
    for (const edge of edges) {
      const changedFilePath = edge.targetFile?.path ?? edge.targetSymbol?.file.path ?? pathByFileId.get(edge.targetSymbolId ?? "");
      if (!changedFilePath) continue;

      entries.push({
        changedFilePath,
        dependentFilePath: edge.sourceSymbol.file.path,
        dependentSymbolName: edge.sourceSymbol.name,
        edgeType: edge.edgeType,
      });
    }

    return entries;
  },

  async listGraphEdges(repositoryId: string): Promise<CodeGraphEdgeResponseDto[]> {
    const edges = await indexingRepository.listGraphEdges(repositoryId);
    return edges.map((e) => ({
      id: e.id,
      sourceSymbolId: e.sourceSymbolId,
      targetSymbolId: e.targetSymbolId,
      targetPackageName: e.targetPackageName,
      edgeType: e.edgeType,
    }));
  },

  async listGraphEdgesForAssistant(repositoryId: string) {
    const edges = await indexingRepository.listGraphEdgesWithNames(repositoryId);
    return edges.map((e) => ({
      source: e.sourceSymbol.name,
      sourceKind: e.sourceSymbol.kind,
      target: e.targetSymbol?.name ?? e.targetPackageName,
      edgeType: e.edgeType,
    }));
  },

  async listApiEndpoints(repositoryId: string): Promise<ApiEndpointResponseDto[]> {
    const endpoints = await indexingRepository.listApiEndpoints(repositoryId);
    return endpoints.map((e) => ({
      id: e.id,
      method: e.method,
      path: e.path,
      framework: e.framework,
      filePath: e.filePath,
      symbolId: e.symbolId,
    }));
  },
};
