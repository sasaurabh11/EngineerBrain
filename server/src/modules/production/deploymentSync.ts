import cron from "node-cron";
import { logger } from "../../config/logger.ts";
import { prisma } from "../../database/prisma.ts";
import { getInstallationOctokit } from "../../infra/github/octokitApp.ts";
import { githubRepository } from "../github/github.repository.ts";
import { GitHubActionsDeploymentAdapter } from "./adapters/githubActionsAdapter.ts";
import { productionRepository } from "./production.repository.ts";

const LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Polls GitHub Actions workflow runs for every Service linked to a
 * repository and upserts them as Deployment rows - the deployment-history
 * backbone the correlation engine reads from. Runs every 10 minutes;
 * GitHub Actions has no lightweight "deployment" webhook this platform
 * already subscribes to, so polling is the pragmatic v1 ingestion path
 * (see architecture note: push-based Alertmanager alerts are the other
 * ingestion path, for incidents rather than deployments). */
export function startDeploymentSyncScheduler(): void {
  cron.schedule("*/10 * * * *", async () => {
    logger.info("Running scheduled deployment sync");
    const services = await prisma.service.findMany({ where: { repositoryId: { not: null } } });

    for (const service of services) {
      try {
        await syncServiceDeployments(service.id, service.organizationId, service.repositoryId!);
      } catch (err) {
        logger.error({ err, serviceId: service.id }, "Failed to sync deployments for service");
      }
    }
  });
}

async function syncServiceDeployments(serviceId: string, organizationId: string, repositoryId: string): Promise<void> {
  const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repo) return;

  const installation = await githubRepository.findByOrganizationId(organizationId);
  if (!installation || installation.status !== "ACTIVE") return;

  const octokit = await getInstallationOctokit(Number(installation.githubInstallationId));
  const adapter = new GitHubActionsDeploymentAdapter(octokit, repo.ownerLogin, repo.name);
  const since = new Date(Date.now() - LOOKBACK_MS);
  const deployments = await adapter.listRecentDeployments(since);

  for (const deployment of deployments) {
    await productionRepository.createDeployment({
      organizationId,
      serviceId,
      repositoryId,
      pullRequestId: null,
      commitSha: deployment.commitSha,
      version: deployment.version,
      environment: deployment.environment,
      status: deployment.status,
      deployedAt: deployment.deployedAt,
      sourceProvider: "GITHUB_ACTIONS",
      sourceRunId: deployment.sourceRunId,
      rawPayload: deployment.rawPayload,
    });
  }
}
