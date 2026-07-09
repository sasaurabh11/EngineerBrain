import { indexingService } from "../../indexing/indexing.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

interface ApiExplorerArgs {
  repository_id?: string;
}

export const apiExplorerTool: AiTool<ApiExplorerArgs> = {
  name: "api_explorer",
  description:
    "Lists detected HTTP API endpoints (method, path, framework, source file) in a repository. Use this for questions about what endpoints/routes exist.",
  parameters: withRepositoryIdParam({}),
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const endpoints = await indexingService.listApiEndpoints(repo.id);
    if (endpoints.length === 0) {
      return { repositoryName: repo.name, endpoints: [], note: "No API endpoints detected in this repository yet." };
    }
    return {
      repositoryName: repo.name,
      endpoints: endpoints.map((e) => ({ method: e.method, path: e.path, framework: e.framework, filePath: e.filePath })),
    };
  },
};
