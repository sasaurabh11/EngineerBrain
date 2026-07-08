import type { GitHubAccountType, InstallationStatus } from "@prisma/client";

export interface GitHubStatusDto {
  connected: boolean;
  status?: InstallationStatus;
  accountLogin?: string;
  accountType?: GitHubAccountType;
  connectedAt?: Date;
}
