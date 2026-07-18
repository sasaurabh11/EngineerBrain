import { NotFoundError, UnauthorizedError } from "../../../common/errors/AppError.ts";
import { logger } from "../../../config/logger.ts";
import { decryptSecret } from "../../../infra/crypto/secretBox.ts";
import { QUEUES } from "../../../infra/rabbitmq/connection.ts";
import { publishToQueue } from "../../../infra/rabbitmq/publisher.ts";
import { productionRepository } from "../production.repository.ts";
import { detectIncidentFromAlert } from "./incidentDetection.ts";
import type { AlertmanagerPayload } from "./alertmanager.types.ts";

interface ProductionEventProcessPayload {
  productionEventId: string;
}

/** Alertmanager has no native request signing, so the integration's stored
 * credential (set when the ProductionIntegration was created) doubles as a
 * shared bearer secret - configure Alertmanager's webhook_config with
 * `bearer_token: <that same value>` pointed at this endpoint's URL. */
async function verifyBearerToken(integrationId: string, bearerToken: string | undefined): Promise<{ organizationId: string }> {
  const integration = await productionRepository.findIntegrationById(integrationId);
  if (!integration || integration.status !== "ACTIVE") {
    throw new NotFoundError("Production integration not found");
  }
  if (integration.encryptedCredential) {
    const expected = decryptSecret(integration.encryptedCredential);
    if (!bearerToken || bearerToken !== expected) {
      throw new UnauthorizedError("Invalid or missing bearer token for this integration's webhook");
    }
  }
  return { organizationId: integration.organizationId };
}

export const alertmanagerService = {
  async receiveWebhook(integrationId: string, bearerToken: string | undefined, payload: AlertmanagerPayload): Promise<void> {
    const { organizationId } = await verifyBearerToken(integrationId, bearerToken);

    for (const alert of payload.alerts) {
      const dedupeKey = `alertmanager:${alert.fingerprint}:${alert.startsAt}`;
      const existing = await productionRepository.findEventByDedupeKey(dedupeKey);
      if (existing) continue;

      const event = await productionRepository.createEvent({
        organizationId,
        integrationId,
        eventType: "METRIC_ALERT",
        dedupeKey,
        rawPayload: alert as unknown as Record<string, unknown>,
      });

      const jobPayload: ProductionEventProcessPayload = { productionEventId: event.id };
      await publishToQueue(QUEUES.PRODUCTION_EVENT_PROCESS, jobPayload);
    }
  },

  async processEvent(productionEventId: string): Promise<void> {
    const event = await productionRepository.findEventById(productionEventId);
    if (!event) {
      throw new Error(`ProductionEvent ${productionEventId} not found`);
    }

    if (event.eventType === "METRIC_ALERT") {
      const alert = event.rawPayload as unknown as { status: "firing" | "resolved"; labels: Record<string, string>; annotations: Record<string, string> };
      await detectIncidentFromAlert(event.organizationId, event.integrationId, alert.status, alert.labels, alert.annotations);
    } else {
      logger.info({ eventType: event.eventType }, "Unhandled production event type, ignoring");
    }

    await productionRepository.markEventProcessed(productionEventId);
  },
};
