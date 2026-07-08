export type RepositoryVisibility = "PUBLIC" | "PRIVATE" | "INTERNAL";
export type SyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
export type PullRequestState = "OPEN" | "CLOSED" | "MERGED";
export type IssueState = "OPEN" | "CLOSED";

export interface Repository {
  id: string;
  githubRepoId: string;
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
  githubPushedAt: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableRepository {
  githubRepoId: string;
  name: string;
  fullName: string;
  ownerLogin: string;
  description: string | null;
  visibility: RepositoryVisibility;
  defaultBranch: string;
  htmlUrl: string;
  alreadyImported: boolean;
}

export interface Branch {
  id: string;
  name: string;
  isProtected: boolean;
  lastCommitSha: string;
  lastCommitAt: string | null;
}

export interface Commit {
  id: string;
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorGithubLogin: string | null;
  committedAt: string;
  htmlUrl: string;
}

export interface Contributor {
  id: string;
  githubLogin: string;
  avatarUrl: string | null;
  contributions: number;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  state: PullRequestState;
  authorLogin: string;
  isDraft: boolean;
  sourceBranch: string;
  targetBranch: string;
  htmlUrl: string;
  githubCreatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  state: IssueState;
  authorLogin: string;
  labels: string[];
  htmlUrl: string;
  githubCreatedAt: string;
  closedAt: string | null;
}

export interface ListRepositoriesFilters {
  search?: string;
  language?: string;
  sort?: "name" | "stars" | "updated" | "imported";
}
