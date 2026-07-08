import cron from "node-cron";
import { logger } from "../../config/logger.ts";
import { prisma } from "../../database/prisma.ts";
import { syncService } from "./sync.service.ts";

export function startSyncScheduler(): void {
  cron.schedule("0 2 * * *", async () => {
    logger.info("Running scheduled repository sync sweep");
    const repositories = await prisma.repository.findMany({ select: { id: true } });

    for (const repo of repositories) {
      await syncService.enqueueSync(repo.id, "SCHEDULED", null);
    }

    logger.info({ count: repositories.length }, "Scheduled sync sweep enqueued");
  });
}
