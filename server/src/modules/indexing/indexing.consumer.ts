import { logger } from "../../config/logger.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { consumeQueue } from "../../infra/rabbitmq/consumer.ts";
import { indexingRepository } from "./indexing.repository.ts";
import { indexingService } from "./indexing.service.ts";
import type { IndexJobPayload } from "./indexing.types.ts";

export function startIndexingConsumer(): void {
  consumeQueue<IndexJobPayload>(QUEUES.REPOSITORY_INDEX, async (payload) => {
    await indexingRepository.markJobRunning(payload.indexingJobId);

    try {
      await indexingService.performIndex(payload.repositoryId, payload.indexingJobId, payload.forceFull);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown indexing error";
      await indexingRepository.markJobFailed(payload.indexingJobId, message);
      await indexingRepository.updateIndexStatus(payload.repositoryId, "FAILED");
      logger.error({ err, repositoryId: payload.repositoryId }, "Repository indexing failed");
      throw err;
    }
  });
}
