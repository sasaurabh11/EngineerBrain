import { BadRequestError } from "../../../common/errors/AppError.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepositoryWithOctokit, withRepositoryIdParam } from "./shared.ts";

interface CiStatusArgs {
  repository_id?: string;
  pull_number?: number;
  ref?: string;
}

export const ciStatusTool: AiTool<CiStatusArgs> = {
  name: "ci_status",
  description:
    "Returns CI/CD status for a commit - GitHub Actions check runs plus any third-party status checks (e.g. CircleCI, Travis). " +
    "Pass either pull_number (checks that PR's latest commit) or a specific ref (branch name or commit SHA).",
  parameters: withRepositoryIdParam({
    pull_number: { type: "number", description: "Pull request number - checks its head commit" },
    ref: { type: "string", description: "Branch name or commit SHA to check directly, if not checking a PR" },
  }),
  async execute(args, ctx: ToolContext) {
    const { repo, octokit } = await resolveRepositoryWithOctokit(ctx, args);

    let ref = args.ref;
    if (!ref && args.pull_number) {
      const { data: pr } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner: repo.ownerLogin,
        repo: repo.name,
        pull_number: args.pull_number,
      });
      ref = pr.head.sha;
    }
    if (!ref) {
      throw new BadRequestError("ci_status requires either pull_number or ref");
    }

    const [checkRunsResponse, statusResponse] = await Promise.all([
      octokit.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", { owner: repo.ownerLogin, repo: repo.name, ref }),
      octokit.request("GET /repos/{owner}/{repo}/commits/{ref}/status", { owner: repo.ownerLogin, repo: repo.name, ref }),
    ]);

    const checkRuns = checkRunsResponse.data.check_runs.map((c) => ({
      name: c.name,
      status: c.status,
      conclusion: c.conclusion,
      htmlUrl: c.html_url,
    }));
    const statuses = statusResponse.data.statuses.map((s) => ({ context: s.context, state: s.state, description: s.description }));

    const hasFailure = checkRuns.some((c) => c.conclusion === "failure" || c.conclusion === "timed_out") || statuses.some((s) => s.state === "failure" || s.state === "error");
    const hasPending =
      checkRuns.some((c) => c.status !== "completed") || statuses.some((s) => s.state === "pending") || (checkRuns.length === 0 && statuses.length === 0);

    return {
      repositoryId: repo.id,
      ref,
      overall: hasFailure ? "failing" : hasPending ? "pending_or_unknown" : "passing",
      checkRuns,
      statuses,
    };
  },
};
