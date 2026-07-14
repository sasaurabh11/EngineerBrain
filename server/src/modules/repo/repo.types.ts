import type { RepositoryVisibility, SyncStatus } from "@prisma/client";

export interface RepositoryResponseDto {
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
  githubPushedAt: Date | null;
  githubCreatedAt: Date;
  githubUpdatedAt: Date;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailableRepositoryDto {
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

export interface BranchResponseDto {
  id: string;
  name: string;
  isProtected: boolean;
  lastCommitSha: string;
  lastCommitAt: Date | null;
}

export interface CommitResponseDto {
  id: string;
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorGithubLogin: string | null;
  committedAt: Date;
  htmlUrl: string;
}

export interface ContributorResponseDto {
  id: string;
  githubLogin: string;
  avatarUrl: string | null;
  contributions: number;
}

export interface PullRequestResponseDto {
  id: string;
  number: number;
  title: string;
  state: string;
  authorLogin: string;
  isDraft: boolean;
  sourceBranch: string;
  targetBranch: string;
  htmlUrl: string;
  githubCreatedAt: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
}

export interface IssueResponseDto {
  id: string;
  number: number;
  title: string;
  state: string;
  authorLogin: string;
  labels: string[];
  htmlUrl: string;
  githubCreatedAt: Date;
  closedAt: Date | null;
}

export interface ListRepositoriesFilters {
  search?: string;
  language?: string;
  sort?: "name" | "stars" | "updated" | "imported";
}

export interface FileContentResponseDto {
  path: string;
  content: string;
}
