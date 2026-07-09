import { NotFoundError } from "../../common/errors/AppError.ts";
import { prisma } from "../../database/prisma.ts";
import { callAiService } from "../../infra/aiService/aiServiceClient.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import type { AiSearchResult, SearchResultDto } from "./search.types.ts";

async function hydrateResults(rawResults: AiSearchResult["results"]): Promise<SearchResultDto[]> {
  if (rawResults.length === 0) {
    return [];
  }

  const chunkIds = rawResults.map((r) => r.chunk_id);
  const chunks = await prisma.chunk.findMany({
    where: { id: { in: chunkIds } },
    include: { symbol: { select: { name: true } }, repository: { select: { name: true } } },
  });
  const chunkById = new Map(chunks.map((c) => [c.id, c]));

  return rawResults
    .map((raw) => {
      const chunk = chunkById.get(raw.chunk_id);
      if (!chunk) return null;

      return {
        chunkId: raw.chunk_id,
        score: raw.score,
        repositoryId: raw.repository_id,
        repositoryName: chunk.repository.name,
        filePath: raw.file_path,
        kind: raw.kind,
        symbolName: chunk.symbol?.name ?? null,
        content: chunk.content,
      };
    })
    .filter((result): result is SearchResultDto => result !== null);
}

export const searchService = {
  async searchRepository(
    organizationId: string,
    repositoryId: string,
    queryText: string,
    limit = 10,
  ): Promise<SearchResultDto[]> {
    const repo = await repoRepository.findByOrgAndId(organizationId, repositoryId);
    if (!repo) {
      throw new NotFoundError("Repository not found");
    }

    const result = await callAiService<AiSearchResult>("/internal/search", {
      body: { query_text: queryText, repository_ids: [repositoryId], limit },
    });

    return hydrateResults(result.results);
  },

  async searchOrganization(organizationId: string, queryText: string, limit = 10): Promise<SearchResultDto[]> {
    const repos = await prisma.repository.findMany({ where: { organizationId }, select: { id: true } });
    if (repos.length === 0) {
      return [];
    }

    const result = await callAiService<AiSearchResult>("/internal/search", {
      body: { query_text: queryText, repository_ids: repos.map((r) => r.id), limit },
    });

    return hydrateResults(result.results);
  },
};
