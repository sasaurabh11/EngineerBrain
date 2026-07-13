import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepositoryWithOctokit, withRepositoryIdParam } from "./shared.ts";

type Conclusion = "success" | "failure" | "neutral" | "action_required";

interface PostCheckRunArgs {
  repository_id?: string;
  head_sha: string;
  title: string;
  summary: string;
  conclusion: Conclusion;
}

export const postCheckRunTool: AiTool<PostCheckRunArgs> = {
  name: "post_check_run",
  description:
    "Posts a native GitHub Check Run on a commit (shows up directly in the PR's merge-status area, like CI) with a title, " +
    "markdown summary, and pass/fail conclusion. Mutates an external system - requires approval.",
  parameters: withRepositoryIdParam(
    {
      head_sha: { type: "string", description: "The commit SHA to attach this check to (typically a PR's head sha)" },
      title: { type: "string", description: "Short check title, e.g. 'AI PR Review'" },
      summary: { type: "string", description: "Markdown summary shown when the check is expanded" },
      conclusion: { type: "string", enum: ["success", "failure", "neutral", "action_required"], description: "Overall verdict" },
    },
    ["head_sha", "title", "summary", "conclusion"],
  ),
  permission: "write",
  async execute(args, ctx: ToolContext) {
    const { repo, octokit } = await resolveRepositoryWithOctokit(ctx, args);
    const { data } = await octokit.request("POST /repos/{owner}/{repo}/check-runs", {
      owner: repo.ownerLogin,
      repo: repo.name,
      name: args.title,
      head_sha: args.head_sha,
      status: "completed",
      conclusion: args.conclusion,
      output: { title: args.title, summary: args.summary },
    });

    return { posted: true, checkRunId: data.id, htmlUrl: data.html_url, repositoryId: repo.id };
  },
};
