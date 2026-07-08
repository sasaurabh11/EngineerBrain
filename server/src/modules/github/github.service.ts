import crypto from "node:crypto";
import { BadRequestError, NotFoundError } from "../../common/errors/AppError.ts";
import { getGitHubApp } from "../../infra/github/octokitApp.ts";
import { githubRepository } from "./github.repository.ts";
import type { GitHubStatusDto } from "./github.types.ts";

const STATE_TTL_MS = 10 * 60 * 1000;

interface PendingInstallState {
  organizationId: string;
  userId: string;
  expiresAt: number;
}

// In-memory: fine for a single API instance (Phase 2 scope). If this ever runs
// as multiple instances behind a load balancer, this needs to move to Redis/DB.
const pendingInstallStates = new Map<string, PendingInstallState>();

function createInstallState(organizationId: string, userId: string): string {
  const state = crypto.randomBytes(24).toString("hex");
  pendingInstallStates.set(state, { organizationId, userId, expiresAt: Date.now() + STATE_TTL_MS });
  return state;
}

function consumeInstallState(state: string): PendingInstallState | null {
  const entry = pendingInstallStates.get(state);
  pendingInstallStates.delete(state);
  if (!entry || entry.expiresAt < Date.now()) {
    return null;
  }
  return entry;
}

export const githubService = {
  async getStatus(organizationId: string): Promise<GitHubStatusDto> {
    const installation = await githubRepository.findByOrganizationId(organizationId);
    if (!installation) {
      return { connected: false };
    }

    return {
      connected: installation.status === "ACTIVE",
      status: installation.status,
      accountLogin: installation.githubAccountLogin,
      accountType: installation.githubAccountType,
      connectedAt: installation.createdAt,
    };
  },

  async getInstallUrl(organizationId: string, userId: string): Promise<string> {
    const app = getGitHubApp();
    const state = createInstallState(organizationId, userId);
    return app.getInstallationUrl({ state });
  },

  async handleCallback(githubInstallationId: number, state: string): Promise<{ organizationId: string }> {
    const pending = consumeInstallState(state);
    if (!pending) {
      throw new BadRequestError("Invalid or expired installation state");
    }

    const app = getGitHubApp();
    const { data: installation } = await app.octokit.request("GET /app/installations/{installation_id}", {
      installation_id: githubInstallationId,
    });

    const account = installation.account;
    const accountLogin = account && "login" in account ? account.login : "unknown";
    const accountId = account?.id ?? 0;
    const accountType = account && "type" in account && account.type === "Organization" ? "ORGANIZATION" : "USER";

    await githubRepository.upsertForOrganization({
      organizationId: pending.organizationId,
      githubInstallationId: BigInt(githubInstallationId),
      githubAccountLogin: accountLogin,
      githubAccountId: BigInt(accountId),
      githubAccountType: accountType,
      connectedById: pending.userId,
    });

    return { organizationId: pending.organizationId };
  },

  async disconnect(organizationId: string): Promise<void> {
    const installation = await githubRepository.findByOrganizationId(organizationId);
    if (!installation) {
      throw new NotFoundError("GitHub is not connected for this organization");
    }
    await githubRepository.updateStatus(installation.id, "UNINSTALLED");
  },
};
