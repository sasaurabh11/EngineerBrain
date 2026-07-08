import type { GitHubAccountType, InstallationStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export const githubRepository = {
  findByOrganizationId(organizationId: string) {
    return prisma.gitHubInstallation.findUnique({ where: { organizationId } });
  },

  findByGithubInstallationId(githubInstallationId: bigint) {
    return prisma.gitHubInstallation.findUnique({ where: { githubInstallationId } });
  },

  upsertForOrganization(data: {
    organizationId: string;
    githubInstallationId: bigint;
    githubAccountLogin: string;
    githubAccountId: bigint;
    githubAccountType: GitHubAccountType;
    connectedById: string;
  }) {
    return prisma.gitHubInstallation.upsert({
      where: { organizationId: data.organizationId },
      create: { ...data, status: "ACTIVE" },
      update: {
        githubInstallationId: data.githubInstallationId,
        githubAccountLogin: data.githubAccountLogin,
        githubAccountId: data.githubAccountId,
        githubAccountType: data.githubAccountType,
        connectedById: data.connectedById,
        status: "ACTIVE",
      },
    });
  },

  updateStatus(id: string, status: InstallationStatus) {
    return prisma.gitHubInstallation.update({ where: { id }, data: { status } });
  },
};
