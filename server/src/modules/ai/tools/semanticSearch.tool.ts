import { searchService } from "../../search/search.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { withRepositoryIdParam } from "./shared.ts";

interface SemanticSearchArgs {
  query: string;
  repository_id?: string;
  limit?: number;
}

export const semanticSearchTool: AiTool<SemanticSearchArgs> = {
  name: "semantic_search",
  description:
    "Searches repository source code by meaning (not exact keyword match). Use this first for almost any question about how the codebase works, where something is implemented, or which files are relevant.",
  parameters: withRepositoryIdParam(
    {
      query: { type: "string", description: "Natural-language description of what to find" },
      limit: { type: "number", description: "Max results to return (default 8)" },
    },
    ["query"],
  ),
  async execute(args, ctx: ToolContext) {
    const limit = args.limit ?? 8;
    if (ctx.repositoryId) {
      return searchService.searchRepository(ctx.organizationId, ctx.repositoryId, args.query, limit);
    }
    if (args.repository_id) {
      return searchService.searchRepository(ctx.organizationId, args.repository_id, args.query, limit);
    }
    return searchService.searchOrganization(ctx.organizationId, args.query, limit);
  },
};
