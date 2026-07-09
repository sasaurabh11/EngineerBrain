import { indexingService } from "../../indexing/indexing.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

interface RepositoryStructureArgs {
  repository_id?: string;
}

export const repositoryStructureTool: AiTool<RepositoryStructureArgs> = {
  name: "repository_structure",
  description:
    "Lists all indexed files in a repository with their language and size. Use this to understand the overall layout of a repository before diving into specific files.",
  parameters: withRepositoryIdParam({}),
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const files = await indexingService.listFiles(repo.id);
    return {
      repositoryName: repo.name,
      totalFiles: files.length,
      files: files.map((f) => ({ path: f.path, language: f.language, linesOfCode: f.linesOfCode })),
    };
  },
};
