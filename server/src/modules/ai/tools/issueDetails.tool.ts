import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepositoryWithOctokit, withRepositoryIdParam } from "./shared.ts";

const MAX_COMMENTS = 20;

interface IssueDetailsArgs {
  repository_id?: string;
  issue_number: number;
}

export const issueDetailsTool: AiTool<IssueDetailsArgs> = {
  name: "issue_details",
  description: "Returns a GitHub issue's title, description, labels, author, and recent comments.",
  parameters: withRepositoryIdParam(
    { issue_number: { type: "number", description: "Issue number" } },
    ["issue_number"],
  ),
  async execute(args, ctx: ToolContext) {
    const { repo, octokit } = await resolveRepositoryWithOctokit(ctx, args);

    const [{ data: issue }, { data: comments }] = await Promise.all([
      octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner: repo.ownerLogin,
        repo: repo.name,
        issue_number: args.issue_number,
      }),
      octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner: repo.ownerLogin,
        repo: repo.name,
        issue_number: args.issue_number,
        per_page: MAX_COMMENTS,
      }),
    ]);

    return {
      repositoryId: repo.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      author: issue.user?.login ?? null,
      labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
      commentCount: issue.comments,
      htmlUrl: issue.html_url,
      recentComments: comments.map((c) => ({ author: c.user?.login ?? null, body: c.body, createdAt: c.created_at })),
    };
  },
};
