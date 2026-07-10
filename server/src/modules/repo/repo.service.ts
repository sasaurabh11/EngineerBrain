import type { RepositoryVisibility } from "@prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../../common/errors/AppError.ts";
import { getInstallationOctokit } from "../../infra/github/octokitApp.ts";
import { githubRepository } from "../github/github.repository.ts";
import { indexingService } from "../indexing/indexing.service.ts";
import { syncService } from "../sync/sync.service.ts";
import { repoRepository, type RepositoryUpsertData } from "./repo.repository.ts";
import type {
  AvailableRepositoryDto,
  BranchResponseDto,
  CommitResponseDto,
  ContributorResponseDto,
  IssueResponseDto,
  ListRepositoriesFilters,
  PullRequestResponseDto,
  RepositoryResponseDto,
} from "./repo.types.ts";

interface GitHubRepoPayload {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  visibility?: string;
  default_branch: string;
  language: string | null;
  topics?: string[];
  clone_url: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  pushed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function toVisibility(repo: GitHubRepoPayload): RepositoryVisibility {
  const value = repo.visibility ?? (repo.private ? "private" : "public");
  return value.toUpperCase() as RepositoryVisibility;
}

async function getActiveInstallationOrThrow(organizationId: string) {
  const installation = await githubRepository.findByOrganizationId(organizationId);
  if (!installation || installation.status !== "ACTIVE") {
    throw new BadRequestError("GitHub is not connected for this organization");
  }
  return installation;
}

export const repoService = {
  async listAvailable(organizationId: string): Promise<AvailableRepositoryDto[]> {
    const installation = await getActiveInstallationOrThrow(organizationId);
    const octokit = await getInstallationOctokit(Number(installation.githubInstallationId));

    const importedIds = new Set(
      (await repoRepository.listGithubRepoIdsForOrg(organizationId)).map((r) => r.githubRepoId.toString()),
    );

    const repos = await octokit.paginate("GET /installation/repositories");

    return (repos as unknown as GitHubRepoPayload[]).map((repo) => ({
      githubRepoId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      ownerLogin: repo.owner.login,
      description: repo.description,
      visibility: toVisibility(repo),
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      alreadyImported: importedIds.has(String(repo.id)),
    }));
  },

  async listImported(organizationId: string, filters: ListRepositoriesFilters): Promise<RepositoryResponseDto[]> {
    const repos = await repoRepository.listByOrg(organizationId, filters);
    return repos.map(repoService.toResponse);
  },

  async getById(organizationId: string, repositoryId: string): Promise<RepositoryResponseDto> {
    const repo = await repoRepository.findByOrgAndId(organizationId, repositoryId);
    if (!repo) {
      throw new NotFoundError("Repository not found");
    }
    return repoService.toResponse(repo);
  },

  async importRepositories(
    organizationId: string,
    userId: string,
    githubRepoIds: string[],
  ): Promise<RepositoryResponseDto[]> {
    const installation = await getActiveInstallationOrThrow(organizationId);
    const octokit = await getInstallationOctokit(Number(installation.githubInstallationId));

    const requestedIds = new Set(githubRepoIds);
    const allRepos = (await octokit.paginate("GET /installation/repositories")) as unknown as GitHubRepoPayload[];
    const matched = allRepos.filter((repo) => requestedIds.has(String(repo.id)));

    if (matched.length === 0) {
      throw new BadRequestError("None of the requested repositories are accessible to this installation");
    }

    const imported: RepositoryResponseDto[] = [];

    for (const repo of matched) {
      const githubRepoId = BigInt(repo.id);
      const existing = await repoRepository.findByOrgAndGithubRepoId(organizationId, githubRepoId);
      if (existing) {
        continue;
      }

      const data: RepositoryUpsertData = {
        organizationId,
        installationId: installation.id,
        githubRepoId,
        name: repo.name,
        fullName: repo.full_name,
        ownerLogin: repo.owner.login,
        description: repo.description,
        visibility: toVisibility(repo),
        defaultBranch: repo.default_branch,
        primaryLanguage: repo.language,
        topics: repo.topics ?? [],
        cloneUrl: repo.clone_url,
        htmlUrl: repo.html_url,
        starsCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        openIssuesCount: repo.open_issues_count,
        sizeKb: repo.size,
        githubPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        githubCreatedAt: repo.created_at ? new Date(repo.created_at) : new Date(),
        githubUpdatedAt: repo.updated_at ? new Date(repo.updated_at) : new Date(),
        importedById: userId,
      };

      const created = await repoRepository.create(data);
      await syncService.enqueueSync(created.id, "MANUAL", userId);
      await indexingService.enqueueIndex(created.id, "MANUAL", userId, true);
      imported.push(repoService.toResponse(created));
    }

    if (imported.length === 0) {
      throw new ConflictError("All requested repositories are already imported");
    }

    return imported;
  },

  async remove(organizationId: string, repositoryId: string): Promise<void> {
    const repo = await repoRepository.findByOrgAndId(organizationId, repositoryId);
    if (!repo) {
      throw new NotFoundError("Repository not found");
    }
    await repoRepository.remove(repositoryId);
  },

  async triggerSync(organizationId: string, repositoryId: string, userId: string): Promise<RepositoryResponseDto> {
    const repo = await repoRepository.findByOrgAndId(organizationId, repositoryId);
    if (!repo) {
      throw new NotFoundError("Repository not found");
    }

    await syncService.enqueueSync(repositoryId, "MANUAL", userId);
    const updated = await repoRepository.updateSyncStatus(repositoryId, "PENDING");
    return repoService.toResponse(updated);
  },

  async listBranches(organizationId: string, repositoryId: string): Promise<BranchResponseDto[]> {
    await repoService.assertRepoInOrg(organizationId, repositoryId);
    const branches = await repoRepository.listBranches(repositoryId);
    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      isProtected: b.isProtected,
      lastCommitSha: b.lastCommitSha,
      lastCommitAt: b.lastCommitAt,
    }));
  },

  async listCommits(organizationId: string, repositoryId: string): Promise<CommitResponseDto[]> {
    await repoService.assertRepoInOrg(organizationId, repositoryId);
    const commits = await repoRepository.listCommits(repositoryId, 100);
    return commits.map((c) => ({
      id: c.id,
      sha: c.sha,
      message: c.message,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      authorGithubLogin: c.authorGithubLogin,
      committedAt: c.committedAt,
      htmlUrl: c.htmlUrl,
    }));
  },

  async listContributors(organizationId: string, repositoryId: string): Promise<ContributorResponseDto[]> {
    await repoService.assertRepoInOrg(organizationId, repositoryId);
    const contributors = await repoRepository.listContributors(repositoryId);
    return contributors.map((c) => ({
      id: c.id,
      githubLogin: c.githubLogin,
      avatarUrl: c.avatarUrl,
      contributions: c.contributions,
    }));
  },

  async listPullRequests(organizationId: string, repositoryId: string): Promise<PullRequestResponseDto[]> {
    await repoService.assertRepoInOrg(organizationId, repositoryId);
    const pulls = await repoRepository.listPullRequests(repositoryId);
    return pulls.map((p) => ({
      id: p.id,
      number: p.number,
      title: p.title,
      state: p.state,
      authorLogin: p.authorLogin,
      isDraft: p.isDraft,
      sourceBranch: p.sourceBranch,
      targetBranch: p.targetBranch,
      htmlUrl: p.htmlUrl,
      githubCreatedAt: p.githubCreatedAt,
      mergedAt: p.mergedAt,
      closedAt: p.closedAt,
    }));
  },

  async listIssues(organizationId: string, repositoryId: string): Promise<IssueResponseDto[]> {
    await repoService.assertRepoInOrg(organizationId, repositoryId);
    const issues = await repoRepository.listIssues(repositoryId);
    return issues.map((i) => ({
      id: i.id,
      number: i.number,
      title: i.title,
      state: i.state,
      authorLogin: i.authorLogin,
      labels: i.labels,
      htmlUrl: i.htmlUrl,
      githubCreatedAt: i.githubCreatedAt,
      closedAt: i.closedAt,
    }));
  },

  async assertRepoInOrg(organizationId: string, repositoryId: string): Promise<void> {
    const repo = await repoRepository.findByOrgAndId(organizationId, repositoryId);
    if (!repo) {
      throw new NotFoundError("Repository not found");
    }
  },

  toResponse(repo: {
    id: string;
    githubRepoId: bigint;
    name: string;
    fullName: string;
    ownerLogin: string;
    description: string | null;
    visibility: RepositoryVisibility;
    defaultBranch: string;
    primaryLanguage: string | null;
    topics: string[];
    cloneUrl: string;
    htmlUrl: string;
    starsCount: number;
    forksCount: number;
    openIssuesCount: number;
    sizeKb: number;
    githubPushedAt: Date | null;
    githubCreatedAt: Date;
    githubUpdatedAt: Date;
    syncStatus: RepositoryResponseDto["syncStatus"];
    lastSyncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): RepositoryResponseDto {
    return {
      id: repo.id,
      githubRepoId: repo.githubRepoId.toString(),
      name: repo.name,
      fullName: repo.fullName,
      ownerLogin: repo.ownerLogin,
      description: repo.description,
      visibility: repo.visibility,
      defaultBranch: repo.defaultBranch,
      primaryLanguage: repo.primaryLanguage,
      topics: repo.topics,
      cloneUrl: repo.cloneUrl,
      htmlUrl: repo.htmlUrl,
      starsCount: repo.starsCount,
      forksCount: repo.forksCount,
      openIssuesCount: repo.openIssuesCount,
      sizeKb: repo.sizeKb,
      githubPushedAt: repo.githubPushedAt,
      githubCreatedAt: repo.githubCreatedAt,
      githubUpdatedAt: repo.githubUpdatedAt,
      syncStatus: repo.syncStatus,
      lastSyncedAt: repo.lastSyncedAt,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
    };
  },
};
