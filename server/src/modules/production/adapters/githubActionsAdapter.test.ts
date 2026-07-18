import { describe, expect, it, vi } from "vitest";
import { GitHubActionsDeploymentAdapter } from "./githubActionsAdapter.ts";

function fakeOctokit(runs: unknown[]) {
  return { paginate: vi.fn().mockResolvedValue(runs) };
}

function asOctokit(fake: ReturnType<typeof fakeOctokit>) {
  return fake as unknown as ConstructorParameters<typeof GitHubActionsDeploymentAdapter>[0];
}

const NOW = new Date("2026-01-15T12:00:00Z");
const OLD = new Date("2026-01-01T00:00:00Z");

function run(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 42,
    head_sha: "abcdef1234567890",
    status: "completed",
    conclusion: "success",
    run_started_at: NOW.toISOString(),
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    head_branch: "main",
    ...overrides,
  };
}

describe("GitHubActionsDeploymentAdapter", () => {
  it("maps a completed+success run to a SUCCESS deployment event", async () => {
    const octokit = fakeOctokit([run()]);
    const adapter = new GitHubActionsDeploymentAdapter(asOctokit(octokit), "acme", "widgets");

    const [event] = await adapter.listRecentDeployments(OLD);

    expect(event).toMatchObject({
      sourceRunId: "42",
      version: "abcdef1",
      environment: "main",
      status: "SUCCESS",
      commitSha: "abcdef1234567890",
    });
  });

  it("maps a completed+failure run to FAILED", async () => {
    const octokit = fakeOctokit([run({ conclusion: "failure" })]);
    const adapter = new GitHubActionsDeploymentAdapter(asOctokit(octokit), "acme", "widgets");

    const [event] = await adapter.listRecentDeployments(OLD);
    expect(event!.status).toBe("FAILED");
  });

  it("maps a still-running run to IN_PROGRESS regardless of conclusion", async () => {
    const octokit = fakeOctokit([run({ status: "in_progress", conclusion: null })]);
    const adapter = new GitHubActionsDeploymentAdapter(asOctokit(octokit), "acme", "widgets");

    const [event] = await adapter.listRecentDeployments(OLD);
    expect(event!.status).toBe("IN_PROGRESS");
  });

  it("excludes runs created before the `since` cutoff", async () => {
    const octokit = fakeOctokit([run({ created_at: "2020-01-01T00:00:00Z" })]);
    const adapter = new GitHubActionsDeploymentAdapter(asOctokit(octokit), "acme", "widgets");

    const events = await adapter.listRecentDeployments(OLD);
    expect(events).toHaveLength(0);
  });

  it("scopes the API call to a specific workflow file when provided", async () => {
    const octokit = fakeOctokit([run()]);
    const adapter = new GitHubActionsDeploymentAdapter(asOctokit(octokit), "acme", "widgets", "deploy.yml");

    await adapter.listRecentDeployments(OLD);

    expect(octokit.paginate).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
      expect.objectContaining({ workflow_id: "deploy.yml" }),
    );
  });
});
