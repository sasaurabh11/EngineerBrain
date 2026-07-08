import type { Repository, RepositoryVisibility } from "@prisma/client";
import type { SyncTrigger } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";
import { getInstallationOctokit } from "../../infra/github/octokitApp.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { publishToQueue } from "../../infra/rabbitmq/publisher.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { syncRepository } from "./sync.repository.ts";
import type { SyncJobPayload } from "./sync.types.ts";

type InstallationOctokit = Awaited<ReturnType<typeof getInstallationOctokit>>;

const RECENT_COMMITS_LIMIT = 15;

function toVisibility(visibility: string | undefined, isPrivate: boolean): RepositoryVisibility {
  const value = visibility ?? (isPrivate ? "private" : "public");
  return value.toUpperCase() as RepositoryVisibility;
}

async function syncRepositoryMetadata(octokit: InstallationOctokit, repo: Repository) {
  const { data: freshRepo } = await octokit.request("GET /repos/{owner}/{repo}", {
    owner: repo.ownerLogin,
    repo: repo.name,
  });

  await repoRepository.updateMetadata(repo.id, {
    githubRepoId: BigInt(freshRepo.id),
    name: freshRepo.name,
    fullName: freshRepo.full_name,
    ownerLogin: freshRepo.owner.login,
    description: freshRepo.description,
    visibility: toVisibility(freshRepo.visibility, freshRepo.private),
    defaultBranch: freshRepo.default_branch,
    primaryLanguage: freshRepo.language,
    topics: freshRepo.topics ?? [],
    cloneUrl: freshRepo.clone_url,
    htmlUrl: freshRepo.html_url,
    starsCount: freshRepo.stargazers_count,
    forksCount: freshRepo.forks_count,
    openIssuesCount: freshRepo.open_issues_count,
    sizeKb: freshRepo.size,
    githubPushedAt: freshRepo.pushed_at ? new Date(freshRepo.pushed_at) : null,
    githubCreatedAt: freshRepo.created_at ? new Date(freshRepo.created_at) : new Date(),
    githubUpdatedAt: freshRepo.updated_at ? new Date(freshRepo.updated_at) : new Date(),
  });

  return freshRepo;
}

async function syncBranchesAndCommits(
  octokit: InstallationOctokit,
  repositoryId: string,
  ownerLogin: string,
  name: string,
  defaultBranch: string,
  isFirstSync: boolean,
) {
  const branches = await octokit.paginate("GET /repos/{owner}/{repo}/branches", {
    owner: ownerLogin,
    repo: name,
    per_page: 100,
  });

  const commits = isFirstSync
    ? await octokit.paginate("GET /repos/{owner}/{repo}/commits", {
        owner: ownerLogin,
        repo: name,
        sha: defaultBranch,
        per_page: 100,
      })
    : (
        await octokit.request("GET /repos/{owner}/{repo}/commits", {
          owner: ownerLogin,
          repo: name,
          sha: defaultBranch,
          per_page: RECENT_COMMITS_LIMIT,
        })
      ).data;

  for (const branch of branches) {
    const tipCommit = commits.find((commit) => commit.sha === branch.commit.sha);
    const lastCommitAt = tipCommit?.commit.author?.date ? new Date(tipCommit.commit.author.date) : null;

    await prisma.branch.upsert({
      where: { repositoryId_name: { repositoryId, name: branch.name } },
      create: {
        repositoryId,
        name: branch.name,
        isProtected: branch.protected,
        lastCommitSha: branch.commit.sha,
        lastCommitAt,
      },
      update: {
        isProtected: branch.protected,
        lastCommitSha: branch.commit.sha,
        ...(lastCommitAt ? { lastCommitAt } : {}),
      },
    });
  }

  for (const commit of commits) {
    const author = commit.commit.author;
    await prisma.commit.upsert({
      where: { repositoryId_sha: { repositoryId, sha: commit.sha } },
      create: {
        repositoryId,
        sha: commit.sha,
        message: commit.commit.message,
        authorName: author?.name ?? "Unknown",
        authorEmail: author?.email ?? "unknown@example.com",
        authorGithubLogin: commit.author && "login" in commit.author ? commit.author.login : null,
        committedAt: author?.date ? new Date(author.date) : new Date(),
        htmlUrl: commit.html_url,
      },
      update: {},
    });
  }
}

async function syncContributors(octokit: InstallationOctokit, repositoryId: string, ownerLogin: string, name: string) {
  const contributors = await octokit.paginate("GET /repos/{owner}/{repo}/contributors", {
    owner: ownerLogin,
    repo: name,
    per_page: 100,
  });

  for (const contributor of contributors) {
    if (!contributor.id || !contributor.login) continue;

    await prisma.contributor.upsert({
      where: { repositoryId_githubUserId: { repositoryId, githubUserId: BigInt(contributor.id) } },
      create: {
        repositoryId,
        githubUserId: BigInt(contributor.id),
        githubLogin: contributor.login,
        avatarUrl: contributor.avatar_url ?? null,
        contributions: contributor.contributions,
      },
      update: {
        githubLogin: contributor.login,
        avatarUrl: contributor.avatar_url ?? null,
        contributions: contributor.contributions,
      },
    });
  }
}

async function syncPullRequests(octokit: InstallationOctokit, repositoryId: string, ownerLogin: string, name: string) {
  const pullRequests = await octokit.paginate("GET /repos/{owner}/{repo}/pulls", {
    owner: ownerLogin,
    repo: name,
    state: "all",
    per_page: 100,
  });

  for (const pr of pullRequests) {
    const state = pr.merged_at ? "MERGED" : pr.state === "open" ? "OPEN" : "CLOSED";

    await prisma.pullRequest.upsert({
      where: { repositoryId_number: { repositoryId, number: pr.number } },
      create: {
        repositoryId,
        githubId: BigInt(pr.id),
        number: pr.number,
        title: pr.title,
        state,
        authorLogin: pr.user?.login ?? "unknown",
        isDraft: pr.draft ?? false,
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
        htmlUrl: pr.html_url,
        githubCreatedAt: new Date(pr.created_at),
        githubUpdatedAt: new Date(pr.updated_at),
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      },
      update: {
        title: pr.title,
        state,
        isDraft: pr.draft ?? false,
        githubUpdatedAt: new Date(pr.updated_at),
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      },
    });
  }
}

async function syncIssues(octokit: InstallationOctokit, repositoryId: string, ownerLogin: string, name: string) {
  const issues = await octokit.paginate("GET /repos/{owner}/{repo}/issues", {
    owner: ownerLogin,
    repo: name,
    state: "all",
    per_page: 100,
  });

  for (const issue of issues) {
    if ("pull_request" in issue && issue.pull_request) continue;

    const labels = issue.labels
      .map((label) => (typeof label === "string" ? label : label.name ?? ""))
      .filter(Boolean);

    await prisma.issue.upsert({
      where: { repositoryId_number: { repositoryId, number: issue.number } },
      create: {
        repositoryId,
        githubId: BigInt(issue.id),
        number: issue.number,
        title: issue.title,
        state: issue.state === "open" ? "OPEN" : "CLOSED",
        authorLogin: issue.user?.login ?? "unknown",
        labels,
        htmlUrl: issue.html_url,
        githubCreatedAt: new Date(issue.created_at),
        githubUpdatedAt: new Date(issue.updated_at),
        closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      },
      update: {
        title: issue.title,
        state: issue.state === "open" ? "OPEN" : "CLOSED",
        labels,
        githubUpdatedAt: new Date(issue.updated_at),
        closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      },
    });
  }
}

export const syncService = {
  async enqueueSync(repositoryId: string, trigger: SyncTrigger, triggeredById: string | null): Promise<void> {
    const syncRecord = await syncRepository.create(repositoryId, trigger, triggeredById);
    await repoRepository.updateSyncStatus(repositoryId, "PENDING");

    const payload: SyncJobPayload = { repositorySyncId: syncRecord.id, repositoryId };
    await publishToQueue(QUEUES.REPOSITORY_SYNC, payload);
  },

  async performSync(repositoryId: string): Promise<void> {
    const repo = await repoRepository.findById(repositoryId);
    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    const installation = await prisma.gitHubInstallation.findUnique({ where: { id: repo.installationId } });
    if (!installation) {
      throw new Error(`GitHub installation for repository ${repositoryId} not found`);
    }

    const octokit = await getInstallationOctokit(Number(installation.githubInstallationId));
    const isFirstSync = repo.lastSyncedAt === null;

    const freshRepo = await syncRepositoryMetadata(octokit, repo);
    await syncBranchesAndCommits(octokit, repositoryId, repo.ownerLogin, repo.name, freshRepo.default_branch, isFirstSync);
    await syncContributors(octokit, repositoryId, repo.ownerLogin, repo.name);
    await syncPullRequests(octokit, repositoryId, repo.ownerLogin, repo.name);
    await syncIssues(octokit, repositoryId, repo.ownerLogin, repo.name);

    await repoRepository.updateSyncStatus(repositoryId, "SYNCED", new Date());
  },
};
