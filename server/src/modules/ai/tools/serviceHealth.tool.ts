import { NotFoundError } from "../../../common/errors/AppError.ts";
import { resolveMetricsAdapter } from "../../production/adapters/adapterFactory.ts";
import { productionRepository } from "../../production/production.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  service_id: string;
}

/** Live-queries Prometheus when the service's integration config supplies
 * PromQL expressions (config.errorRateQuery / config.p95LatencyQuery);
 * otherwise falls back to the last recorded ServiceHealthSnapshot. Being
 * explicit about which of the two it returned, rather than presenting a
 * stale snapshot as if it were live. */
export const serviceHealthTool: AiTool<Args> = {
  name: "service_health",
  description: "Gets a service's current health: error rate, p95 latency, and risk score - live from its configured metrics integration where available, otherwise the last recorded snapshot.",
  parameters: {
    type: "object",
    properties: { service_id: { type: "string", description: "Service UUID" } },
    required: ["service_id"],
  },
  async execute(args, ctx: ToolContext) {
    const service = await productionRepository.findServiceByOrgAndId(ctx.organizationId, args.service_id);
    if (!service) throw new NotFoundError("Service not found");

    if (service.integrationId) {
      const integration = await productionRepository.findIntegrationByOrgAndId(ctx.organizationId, service.integrationId);
      const config = (integration?.config ?? {}) as { errorRateQuery?: string; p95LatencyQuery?: string };
      if (integration && (config.errorRateQuery || config.p95LatencyQuery)) {
        const adapter = resolveMetricsAdapter(integration);
        const [errorRate, p95Latency] = await Promise.all([
          config.errorRateQuery ? adapter.queryInstant(config.errorRateQuery) : Promise.resolve(null),
          config.p95LatencyQuery ? adapter.queryInstant(config.p95LatencyQuery) : Promise.resolve(null),
        ]);
        return {
          serviceId: service.id,
          source: "live" as const,
          capturedAt: new Date().toISOString(),
          errorRate: errorRate?.value ?? null,
          p95LatencyMs: p95Latency?.value ?? null,
        };
      }
    }

    const snapshot = await productionRepository.latestHealthSnapshot(service.id);
    return {
      serviceId: service.id,
      source: "snapshot" as const,
      capturedAt: snapshot?.capturedAt.toISOString() ?? null,
      errorRate: snapshot?.errorRate ?? null,
      p95LatencyMs: snapshot?.p95LatencyMs ?? null,
      riskScore: snapshot?.riskScore ?? null,
      message: snapshot ? undefined : "No live metrics query configured and no health snapshot recorded yet for this service.",
    };
  },
};
