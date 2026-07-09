import "dotenv/config";
import { app } from "./app.ts";
import { env } from "./config/env.ts";
import { logger } from "./config/logger.ts";
import { startIndexingConsumer } from "./modules/indexing/indexing.consumer.ts";
import { startSyncConsumer } from "./modules/sync/sync.consumer.ts";
import { startSyncScheduler } from "./modules/sync/sync.scheduler.ts";
import { startWebhookConsumer } from "./modules/webhook/webhook.consumer.ts";

app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

startSyncConsumer();
startWebhookConsumer();
startIndexingConsumer();
startSyncScheduler();
