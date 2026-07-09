export interface CitationCandidate {
  chunkId: string | null;
  filePath: string;
  repositoryId: string;
}

function isCitable(value: unknown): value is { chunkId?: unknown; filePath: string; repositoryId: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.filePath === "string" && typeof candidate.repositoryId === "string";
}

/** Duck-types citation-worthy file references out of any tool result shape -
 * search results (arrays) and reader tools (single objects or a `matches` array) -
 * without hardcoding per-tool-name logic. */
export function extractCitations(result: unknown): CitationCandidate[] {
  if (Array.isArray(result)) {
    return result.filter(isCitable).map((item) => ({
      chunkId: typeof item.chunkId === "string" ? item.chunkId : null,
      filePath: item.filePath,
      repositoryId: item.repositoryId,
    }));
  }

  if (isCitable(result)) {
    return [{ chunkId: typeof result.chunkId === "string" ? result.chunkId : null, filePath: result.filePath, repositoryId: result.repositoryId }];
  }

  if (result && typeof result === "object" && Array.isArray((result as Record<string, unknown>).matches)) {
    return extractCitations((result as Record<string, unknown>).matches);
  }

  return [];
}
