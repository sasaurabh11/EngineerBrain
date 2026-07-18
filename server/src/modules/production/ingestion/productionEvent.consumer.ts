import { logger } from "../../../config/logger.ts";
import { QUEUES } from "../../../infra/rabbitmq/connection.ts";
import { consumeQueue } from "../../../infra/rabbitmq/consumer.ts";
import { productionRepository } from "../production.repository.ts";
import { alertmanagerService } from "./alertmanager.service.ts";

interface ProductionEventProcessPayload {
  productionEventId: string;
}

export function startProductionEventConsumer(): void {
  consumeQueue<ProductionEventProcessPayload>(QUEUES.PRODUCTION_EVENT_PROCESS, async (payload) => {
    try {
      await alertmanagerService.processEvent(payload.productionEventId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown production event processing error";
      await productionRepository.markEventFailed(payload.productionEventId, message);
      logger.error({ err, productionEventId: payload.productionEventId }, "Failed to process production event");
      throw err;
    }
  });
}
