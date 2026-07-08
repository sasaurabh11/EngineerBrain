import { Prisma } from "@prisma/client";
import { BadRequestError, UnauthorizedError } from "../../common/errors/AppError.ts";
import { logger } from "../../config/logger.ts";
import { getGitHubApp } from "../../infra/github/octokitApp.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { publishToQueue } from "../../infra/rabbitmq/publisher.ts";
import { githubRepository } from "../github/github.repository.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { syncService } from "../sync/sync.service.ts";
import { webhookRepository } from "./webhook.repository.ts";
import type { GitHubWebhookHeaders, WebhookProcessPayload } from "./webhook.types.ts";

interface RepositoryEventPayload {
  action?: string;
  installation?: { id: number };
  repository?: { id: number };
}

interface InstallationEventPayload {
  action: string;
  installation: { id: number };
}

export const webhookService = {
  async receiveEvent(headers: GitHubWebhookHeaders, rawBody: string): Promise<void> {
    const app = getGitHubApp();
    const isValid = await app.webhooks.verify(rawBody, headers.signature);
    if (!isValid) {
      throw new UnauthorizedError("Invalid webhook signature");
    }

    if (!headers.deliveryId || !headers.eventType) {
      throw new BadRequestError("Missing required GitHub webhook headers");
    }

    const parsed = JSON.parse(rawBody) as RepositoryEventPayload;
    const installationId = parsed.installation?.id ? String(parsed.installation.id) : null;

    let event;
    try {
      event = await webhookRepository.create({
        installationId,
        githubDeliveryId: headers.deliveryId,
        eventType: headers.eventType,
        action: parsed.action ?? null,
        payload: parsed,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        logger.info({ deliveryId: headers.deliveryId }, "Duplicate GitHub webhook delivery, ignoring");
        return;
      }
      throw err;
    }

    const payload: WebhookProcessPayload = { webhookEventId: event.id };
    await publishToQueue(QUEUES.WEBHOOK_PROCESS, payload);
  },

  async processEvent(webhookEventId: string): Promise<void> {
    const event = await webhookRepository.findById(webhookEventId);
    if (!event) {
      throw new Error(`WebhookEvent ${webhookEventId} not found`);
    }

    switch (event.eventType) {
      case "push":
      case "pull_request":
      case "issues":
      case "repository":
        await handleRepositoryScopedEvent(event.installationId, event.payload as unknown as RepositoryEventPayload);
        break;
      case "installation":
        await handleInstallationEvent(event.payload as unknown as InstallationEventPayload);
        break;
      case "installation_repositories":
        logger.info({ installationId: event.installationId }, "installation_repositories event received");
        break;
      default:
        logger.info({ eventType: event.eventType }, "Unhandled GitHub webhook event type, ignoring");
    }

    await webhookRepository.markProcessed(webhookEventId);
  },
};

async function handleRepositoryScopedEvent(
  rawInstallationId: string | null,
  payload: RepositoryEventPayload,
): Promise<void> {
  if (!rawInstallationId || !payload.repository) {
    return;
  }

  const installation = await githubRepository.findByGithubInstallationId(BigInt(rawInstallationId));
  if (!installation) {
    return;
  }

  const repo = await repoRepository.findByOrgAndGithubRepoId(installation.organizationId, BigInt(payload.repository.id));
  if (!repo) {
    return;
  }

  await syncService.enqueueSync(repo.id, "WEBHOOK", null);
}

async function handleInstallationEvent(payload: InstallationEventPayload): Promise<void> {
  const installation = await githubRepository.findByGithubInstallationId(BigInt(payload.installation.id));
  if (!installation) {
    return;
  }

  if (payload.action === "deleted") {
    await githubRepository.updateStatus(installation.id, "UNINSTALLED");
  } else if (payload.action === "suspend") {
    await githubRepository.updateStatus(installation.id, "SUSPENDED");
  } else if (payload.action === "unsuspend") {
    await githubRepository.updateStatus(installation.id, "ACTIVE");
  }
}
