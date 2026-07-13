import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepositoryWithOctokit, withRepositoryIdParam } from "./shared.ts";

interface PrDetailsArgs {
  repository_id?: string;
  pull_number: number;
}

export const prDetailsTool: AiTool<PrDetailsArgs> = {
  name: "pr_details",
  description:
    "Returns a pull request's metadata: title, description, author, base/head branches and commits, mergeable state, and change counts.",
  parameters: withRepositoryIdParam(
    { pull_number: { type: "number", description: "Pull request number" } },
    ["pull_number"],
  ),
  async execute(args, ctx: ToolContext) {
    const { repo, octokit } = await resolveRepositoryWithOctokit(ctx, args);
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: repo.ownerLogin,
      repo: repo.name,
      pull_number: args.pull_number,
    });

    return {
      repositoryId: repo.id,
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      isDraft: data.draft,
      author: data.user?.login ?? null,
      baseRef: data.base.ref,
      baseSha: data.base.sha,
      headRef: data.head.ref,
      headSha: data.head.sha,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
      commits: data.commits,
      mergeable: data.mergeable,
      mergeableState: data.mergeable_state,
      htmlUrl: data.html_url,
    };
  },
};
