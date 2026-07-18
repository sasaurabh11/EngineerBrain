import type { getInstallationOctokit } from "../../../infra/github/octokitApp.ts";
import type { DeploymentAdapter, DeploymentEvent } from "./adapter.types.ts";

type InstallationOctokit = Awaited<ReturnType<typeof getInstallationOctokit>>;

interface GithubWorkflowRun {
  id: number;
  head_sha: string;
  status: string;
  conclusion: string | null;
  run_started_at: string | null;
  created_at: string;
  updated_at: string;
  head_branch: string;
}

function toDeploymentStatus(run: GithubWorkflowRun): DeploymentEvent["status"] {
  if (run.status !== "completed") return "IN_PROGRESS";
  if (run.conclusion === "success") return "SUCCESS";
  if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "startup_failure") return "FAILED";
  return "SUCCESS";
}

/** Treats GitHub Actions workflow runs as deployment events - real,
 * well-documented GitHub REST API
 * (https://docs.github.com/en/rest/actions/workflow-runs), reusing the same
 * installation-scoped Octokit client every existing GitHub tool already
 * uses (see ai/tools/shared.ts::resolveRepositoryWithOctokit). Scope to a
 * specific deploy workflow via `workflowFileName` where possible - without
 * it, every workflow run is treated as a deployment signal, which is noisy
 * but a reasonable default for repos with a single CI/CD workflow. */
export class GitHubActionsDeploymentAdapter implements DeploymentAdapter {
  private readonly octokit: InstallationOctokit;
  private readonly owner: string;
  private readonly repo: string;
  private readonly workflowFileName: string | undefined;

  constructor(octokit: InstallationOctokit, owner: string, repo: string, workflowFileName?: string) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
    this.workflowFileName = workflowFileName;
  }

  async listRecentDeployments(since: Date): Promise<DeploymentEvent[]> {
    const runs = this.workflowFileName
      ? await this.octokit.paginate("GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs", {
          owner: this.owner,
          repo: this.repo,
          workflow_id: this.workflowFileName,
          per_page: 100,
        })
      : await this.octokit.paginate("GET /repos/{owner}/{repo}/actions/runs", {
          owner: this.owner,
          repo: this.repo,
          per_page: 100,
        });

    return (runs as unknown as GithubWorkflowRun[])
      .filter((run) => new Date(run.created_at) >= since)
      .map((run) => ({
        sourceRunId: String(run.id),
        version: run.head_sha.slice(0, 7),
        environment: run.head_branch,
        status: toDeploymentStatus(run),
        deployedAt: new Date(run.run_started_at ?? run.created_at),
        commitSha: run.head_sha,
        rawPayload: run as unknown as Record<string, unknown>,
      }));
  }
}
