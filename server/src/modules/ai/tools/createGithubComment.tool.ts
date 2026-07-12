import { NotFoundError } from "../../../common/errors/AppError.ts";
import { getInstallationOctokit } from "../../../infra/github/octokitApp.ts";
import { githubRepository } from "../../github/github.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

interface CreateGithubCommentArgs {
  repository_id?: string;
  issue_number: number;
  body: string;
}

export const createGithubCommentTool: AiTool<CreateGithubCommentArgs> = {
  name: "create_github_comment",
  description:
    "Posts a comment on a GitHub issue or pull request in this repository. Mutates an external system - requires approval.",
  parameters: withRepositoryIdParam(
    {
      issue_number: { type: "number", description: "The issue or PR number to comment on" },
      body: { type: "string", description: "Markdown comment body" },
    },
    ["issue_number", "body"],
  ),
  permission: "write",
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const installation = await githubRepository.findByOrganizationId(ctx.organizationId);
    if (!installation) {
      throw new NotFoundError("GitHub is not connected for this organization");
    }

    const octokit = await getInstallationOctokit(Number(installation.githubInstallationId));
    const { data } = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: repo.ownerLogin,
      repo: repo.name,
      issue_number: args.issue_number,
      body: args.body,
    });

    return { posted: true, commentUrl: data.html_url, repositoryId: repo.id };
  },
};
