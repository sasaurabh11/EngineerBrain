import { searchService } from "../search/search.service.ts";
import type { SearchResultDto } from "../search/search.types.ts";

const MAX_CONTEXT_CHARS = 24_000;
const TOP_K = 8;
const HEADER_OVERHEAD_CHARS = 200;

export interface ContextBlock {
  chunks: SearchResultDto[];
  text: string;
}

/** Retrieval-first context seeding: every user turn is searched up front so the
 * model is grounded before it even considers calling a tool itself. */
export async function buildContext(organizationId: string, query: string, repositoryId?: string): Promise<ContextBlock> {
  const results = repositoryId
    ? await searchService.searchRepository(organizationId, repositoryId, query, TOP_K)
    : await searchService.searchOrganization(organizationId, query, TOP_K);

  const included: SearchResultDto[] = [];
  let charsUsed = 0;

  for (const result of results) {
    const blockChars = result.content.length + HEADER_OVERHEAD_CHARS;
    if (charsUsed + blockChars > MAX_CONTEXT_CHARS && included.length > 0) {
      break;
    }
    included.push(result);
    charsUsed += blockChars;
  }

  const text = included
    .map((r) => `<context file="${r.filePath}" repository="${r.repositoryName}" kind="${r.kind}">\n${r.content}\n</context>`)
    .join("\n\n");

  return { chunks: included, text };
}
