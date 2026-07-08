import type { GitHubStatus } from "../types/github.types";

export function getManageGitHubInstallationUrl(status: GitHubStatus): string | null {
  if (!status.githubInstallationId) {
    return null;
  }

  if (status.accountType === "ORGANIZATION" && status.accountLogin) {
    return `https://github.com/organizations/${status.accountLogin}/settings/installations/${status.githubInstallationId}`;
  }

  return `https://github.com/settings/installations/${status.githubInstallationId}`;
}
