import { Prisma } from "@prisma/client";
import { BadRequestError, ConflictError, UnauthorizedError } from "../../common/errors/AppError.ts";
import { logger } from "../../config/logger.ts";
import { getGitHubApp } from "../../infra/github/octokitApp.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { publishToQueue } from "../../infra/rabbitmq/publisher.ts";
import { githubRepository } from "../github/github.repository.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { syncService } from "../sync/sync.service.ts";
import { taskService } from "../tasks/task.service.ts";
import { webhookRepository } from "./webhook.repository.ts";
import type { GitHubWebhookHeaders, WebhookProcessPayload } from "./webhook.types.ts";

const AUTO_REVIEW_PR_ACTIONS = new Set(["opened", "synchronize", "reopened"]);
const AUTO_TRIAGE_ISSUE_ACTIONS = new Set(["opened"]);

interface RepositoryEventPayload {
  action?: string;
  installation?: { id: number };
  repository?: { id: number };
  pull_request?: { number: number };
  issue?: { number: number; pull_request?: unknown };
}

interface InstallationEventPayload {
  action: string;
  installation: { id: number };
}

interface CheckSuiteEventPayload {
  action: string;
  installation?: { id: number };
  repository?: { id: number };
  check_suite: {
    conclusion: string | null;
    pull_requests: { number: number }[];
  };
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
        await handleRepositoryScopedEvent(event.eventType, event.installationId, event.payload as unknown as RepositoryEventPayload);
        break;
      case "check_suite":
        await handleCheckSuiteEvent(event.installationId, event.payload as unknown as CheckSuiteEventPayload);
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
  eventType: string,
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

  if (eventType === "pull_request" && payload.pull_request && payload.action && AUTO_REVIEW_PR_ACTIONS.has(payload.action)) {
    await autoEnqueueTask(
      repo.id,
      repo.organizationId,
      repo.importedById,
      `Automated PR review for #${payload.pull_request.number} (triggered by ${payload.action})`,
      "pr-review",
      { prNumber: payload.pull_request.number },
    );
  }

  if (
    eventType === "issues" &&
    payload.issue &&
    !payload.issue.pull_request &&
    payload.action &&
    AUTO_TRIAGE_ISSUE_ACTIONS.has(payload.action)
  ) {
    await autoEnqueueTask(
      repo.id,
      repo.organizationId,
      repo.importedById,
      `Automated triage for issue #${payload.issue.number}`,
      "issue-triage",
      { issueNumber: payload.issue.number },
    );
  }
}


async function handleCheckSuiteEvent(rawInstallationId: string | null, payload: CheckSuiteEventPayload): Promise<void> {
  if (payload.action !== "completed" || !rawInstallationId || !payload.repository || payload.check_suite.pull_requests.length === 0) {
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

  for (const pullRequest of payload.check_suite.pull_requests) {
    if (await shouldReviewAfterCiCompletion(repo.organizationId, repo.id, pullRequest.number)) {
      await autoEnqueueTask(
        repo.id,
        repo.organizationId,
        repo.importedById,
        `Automated PR review for #${pullRequest.number} (triggered by CI completion)`,
        "pr-review",
        { prNumber: pullRequest.number },
      );
    }
  }
}

async function shouldReviewAfterCiCompletion(organizationId: string, repositoryId: string, prNumber: number): Promise<boolean> {
  const { items } = await taskService.listTasks(organizationId, {
    repositoryId,
    workflowKey: "pr-review",
    prNumber,
    page: 1,
    pageSize: 1,
  });
  const latest = items[0];

  // No review yet for this PR at all - let the normal auto-enqueue path
  // handle it (also covers the case where "opened" was somehow missed).
  if (!latest) {
    return true;
  }

  if (latest.status !== "COMPLETED") {
    return false;
  }

  const executions = await taskService.getExecutions(organizationId, latest.id);
  const ciStatusCall = executions.flatMap((e) => e.toolInvocations).find((t) => t.toolName === "ci_status");
  const overall = (ciStatusCall?.result as { overall?: string } | undefined)?.overall;

  // The prior review already had a resolved CI status - nothing new to say.
  return overall === "pending_or_unknown";
}

async function autoEnqueueTask(
  repositoryId: string,
  organizationId: string,
  createdById: string,
  goal: string,
  workflowKey: string,
  workflowParams: Record<string, unknown>,
): Promise<void> {
  try {
    await taskService.enqueueTask(organizationId, createdById, goal, repositoryId, workflowKey, workflowParams);
  } catch (err) {
    if (err instanceof ConflictError) {
      logger.info({ organizationId, workflowKey, workflowParams }, "Skipping auto-triggered task - organization already has one in progress");
      return;
    }
    throw err;
  }
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
