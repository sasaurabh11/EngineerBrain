import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepositoryWithOctokit, withRepositoryIdParam } from "./shared.ts";

const MAX_PATCH_CHARS = 2000;
const MAX_FILES = 50;

interface PrDiffArgs {
  repository_id?: string;
  pull_number: number;
}

export const prDiffTool: AiTool<PrDiffArgs> = {
  name: "pr_diff",
  description: "Returns the list of files changed by a pull request, with each file's diff patch (truncated for very large changes).",
  parameters: withRepositoryIdParam(
    { pull_number: { type: "number", description: "Pull request number" } },
    ["pull_number"],
  ),
  async execute(args, ctx: ToolContext) {
    const { repo, octokit } = await resolveRepositoryWithOctokit(ctx, args);
    const files = await octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
      owner: repo.ownerLogin,
      repo: repo.name,
      pull_number: args.pull_number,
      per_page: 100,
    });

    const truncated = files.length > MAX_FILES;
    return {
      repositoryId: repo.id,
      pullNumber: args.pull_number,
      totalFiles: files.length,
      truncated,
      files: files.slice(0, MAX_FILES).map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch ? f.patch.slice(0, MAX_PATCH_CHARS) : null,
      })),
    };
  },
};
