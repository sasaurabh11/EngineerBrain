import type { Prisma, RepositoryVisibility, SyncStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";
import type { ListRepositoriesFilters } from "./repo.types.ts";

function toOrderBy(sort?: ListRepositoriesFilters["sort"]): Prisma.RepositoryOrderByWithRelationInput {
  switch (sort) {
    case "name":
      return { name: "asc" };
    case "stars":
      return { starsCount: "desc" };
    case "updated":
      return { githubPushedAt: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

export interface RepositoryUpsertData {
  organizationId: string;
  installationId: string;
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
  importedById: string;
}

export const repoRepository = {
  listByOrg(organizationId: string, filters: ListRepositoriesFilters) {
    return prisma.repository.findMany({
      where: {
        organizationId,
        ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
        ...(filters.language ? { primaryLanguage: filters.language } : {}),
      },
      orderBy: toOrderBy(filters.sort),
    });
  },

  findByOrgAndId(organizationId: string, repositoryId: string) {
    return prisma.repository.findFirst({ where: { id: repositoryId, organizationId } });
  },

  findById(repositoryId: string) {
    return prisma.repository.findUnique({ where: { id: repositoryId } });
  },

  findByOrgAndGithubRepoId(organizationId: string, githubRepoId: bigint) {
    return prisma.repository.findUnique({
      where: { organizationId_githubRepoId: { organizationId, githubRepoId } },
    });
  },

  listGithubRepoIdsForOrg(organizationId: string): Promise<{ githubRepoId: bigint }[]> {
    return prisma.repository.findMany({
      where: { organizationId },
      select: { githubRepoId: true },
    });
  },

  create(data: RepositoryUpsertData) {
    return prisma.repository.create({ data });
  },

  updateMetadata(id: string, data: Omit<RepositoryUpsertData, "organizationId" | "installationId" | "importedById">) {
    return prisma.repository.update({ where: { id }, data });
  },

  updateSyncStatus(id: string, syncStatus: SyncStatus, lastSyncedAt?: Date) {
    return prisma.repository.update({
      where: { id },
      data: { syncStatus, ...(lastSyncedAt ? { lastSyncedAt } : {}) },
    });
  },

  remove(id: string): Promise<void> {
    return prisma.repository.delete({ where: { id } }).then(() => undefined);
  },

  listBranches(repositoryId: string) {
    return prisma.branch.findMany({ where: { repositoryId }, orderBy: { name: "asc" } });
  },

  listCommits(repositoryId: string, limit: number) {
    return prisma.commit.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "desc" },
      take: limit,
    });
  },

  listContributors(repositoryId: string) {
    return prisma.contributor.findMany({ where: { repositoryId }, orderBy: { contributions: "desc" } });
  },

  listPullRequests(repositoryId: string) {
    return prisma.pullRequest.findMany({ where: { repositoryId }, orderBy: { githubCreatedAt: "desc" } });
  },

  listIssues(repositoryId: string) {
    return prisma.issue.findMany({ where: { repositoryId }, orderBy: { githubCreatedAt: "desc" } });
  },
};
