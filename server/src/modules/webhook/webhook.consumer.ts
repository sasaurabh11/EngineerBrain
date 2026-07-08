import { logger } from "../../config/logger.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { consumeQueue } from "../../infra/rabbitmq/consumer.ts";
import { webhookRepository } from "./webhook.repository.ts";
import { webhookService } from "./webhook.service.ts";
import type { WebhookProcessPayload } from "./webhook.types.ts";

export function startWebhookConsumer(): void {
  consumeQueue<WebhookProcessPayload>(QUEUES.WEBHOOK_PROCESS, async (payload) => {
    try {
      await webhookService.processEvent(payload.webhookEventId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown webhook processing error";
      await webhookRepository.markFailed(payload.webhookEventId, message);
      logger.error({ err, webhookEventId: payload.webhookEventId }, "Failed to process webhook event");
      throw err;
    }
  });
}
