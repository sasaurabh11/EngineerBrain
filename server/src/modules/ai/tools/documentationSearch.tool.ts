import { searchService } from "../../search/search.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { withRepositoryIdParam } from "./shared.ts";

interface DocumentationSearchArgs {
  query: string;
  repository_id?: string;
  limit?: number;
}

export const documentationSearchTool: AiTool<DocumentationSearchArgs> = {
  name: "documentation_search",
  description:
    "Searches README files and markdown documentation (not source code) by meaning. Use this for questions about setup instructions, project overview, or anything likely documented rather than implemented.",
  parameters: withRepositoryIdParam(
    {
      query: { type: "string", description: "Natural-language description of what to find" },
      limit: { type: "number", description: "Max results to return (default 5)" },
    },
    ["query"],
  ),
  async execute(args, ctx: ToolContext) {
    const limit = args.limit ?? 5;
    const kinds = ["DOCUMENTATION"];
    if (ctx.repositoryId) {
      return searchService.searchRepository(ctx.organizationId, ctx.repositoryId, args.query, limit, kinds);
    }
    if (args.repository_id) {
      return searchService.searchRepository(ctx.organizationId, args.repository_id, args.query, limit, kinds);
    }
    return searchService.searchOrganization(ctx.organizationId, args.query, limit, kinds);
  },
};
