import "dotenv/config";
import { app } from "./app.ts";
import { env } from "./config/env.ts";
import { logger } from "./config/logger.ts";
import { startAnalysisConsumer } from "./modules/analysis/analysis.consumer.ts";
import { startIndexingConsumer } from "./modules/indexing/indexing.consumer.ts";
import { startDeploymentSyncScheduler } from "./modules/production/deploymentSync.ts";
import { startProductionEventConsumer } from "./modules/production/ingestion/productionEvent.consumer.ts";
import { startSyncConsumer } from "./modules/sync/sync.consumer.ts";
import { startSyncScheduler } from "./modules/sync/sync.scheduler.ts";
import { startTaskConsumer } from "./modules/tasks/task.consumer.ts";
import { startWebhookConsumer } from "./modules/webhook/webhook.consumer.ts";

app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

startSyncConsumer();
startWebhookConsumer();
startIndexingConsumer();
startAnalysisConsumer();
startTaskConsumer();
startSyncScheduler();
startProductionEventConsumer();
startDeploymentSyncScheduler();
