import type { AiTool, ToolContext } from "./tool.types.ts";
import { fetchFileContent, resolveRepository, withRepositoryIdParam } from "./shared.ts";

const MAX_CONTENT_CHARS = 20_000;

interface FileReaderArgs {
  file_path: string;
  repository_id?: string;
}

export const fileReaderTool: AiTool<FileReaderArgs> = {
  name: "file_reader",
  description: "Reads the full contents of a specific file in a repository, given its path (e.g. from repository_structure or semantic_search results).",
  parameters: withRepositoryIdParam(
    { file_path: { type: "string", description: "Path of the file relative to the repository root" } },
    ["file_path"],
  ),
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const content = await fetchFileContent(ctx.organizationId, repo, args.file_path);

    if (content.length > MAX_CONTENT_CHARS) {
      return {
        filePath: args.file_path,
        repositoryId: repo.id,
        content: content.slice(0, MAX_CONTENT_CHARS),
        truncated: true,
      };
    }

    return { filePath: args.file_path, repositoryId: repo.id, content, truncated: false };
  },
};
