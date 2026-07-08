import { logger } from "../../config/logger.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { consumeQueue } from "../../infra/rabbitmq/consumer.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { syncRepository } from "./sync.repository.ts";
import { syncService } from "./sync.service.ts";
import type { SyncJobPayload } from "./sync.types.ts";

export function startSyncConsumer(): void {
  consumeQueue<SyncJobPayload>(QUEUES.REPOSITORY_SYNC, async (payload) => {
    await syncRepository.markRunning(payload.repositorySyncId);

    try {
      await syncService.performSync(payload.repositoryId);
      await syncRepository.markSuccess(payload.repositorySyncId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown sync error";
      await syncRepository.markFailed(payload.repositorySyncId, message);
      await repoRepository.updateSyncStatus(payload.repositoryId, "FAILED");
      logger.error({ err, repositoryId: payload.repositoryId }, "Repository sync failed");
      throw err;
    }
  });
}
