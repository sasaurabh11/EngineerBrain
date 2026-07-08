export type InstallationStatus = "ACTIVE" | "SUSPENDED" | "UNINSTALLED";
export type GitHubAccountType = "USER" | "ORGANIZATION";

export interface GitHubStatus {
  connected: boolean;
  status?: InstallationStatus;
  accountLogin?: string;
  accountType?: GitHubAccountType;
  connectedAt?: string;
}
