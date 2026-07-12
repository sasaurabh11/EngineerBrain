import { logger } from "../../config/logger.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { consumeQueue } from "../../infra/rabbitmq/consumer.ts";
import { analysisRepository } from "./analysis.repository.ts";
import { analysisService } from "./analysis.service.ts";
import type { AnalysisJobPayload } from "./analysis.types.ts";

export function startAnalysisConsumer(): void {
  consumeQueue<AnalysisJobPayload>(QUEUES.REPOSITORY_ANALYZE, async (payload) => {
    try {
      await analysisService.performAnalysis(payload.repositoryId, payload.analysisId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown analysis error";
      const current = await analysisRepository.findById(payload.analysisId);
      if (current?.status !== "CANCELLED") {
        await analysisRepository.markFailed(payload.analysisId, message);
      }
      logger.error({ err, repositoryId: payload.repositoryId }, "Repository analysis failed");
      throw err;
    }
  });
}
