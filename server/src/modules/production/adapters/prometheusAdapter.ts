import { ServiceUnavailableError } from "../../../common/errors/AppError.ts";
import { logger } from "../../../config/logger.ts";
import type { MetricPoint, MetricSeries, MetricsAdapter } from "./adapter.types.ts";

interface PrometheusVectorResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface PrometheusMatrixResult {
  metric: Record<string, string>;
  values: [number, string][];
}

interface PrometheusResponse<T> {
  status: "success" | "error";
  data?: { resultType: string; result: T[] };
  error?: string;
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Real client for Prometheus's HTTP query API
 * (https://prometheus.io/docs/prometheus/latest/querying/api/) - the
 * standard, stable API surface exposed by both self-hosted Prometheus and
 * most managed Prometheus-compatible backends (Grafana Mimir/Cortex/Thanos). */
export class PrometheusMetricsAdapter implements MetricsAdapter {
  private readonly baseUrl: string;
  private readonly bearerToken: string | undefined;

  constructor(baseUrl: string, bearerToken?: string) {
    this.baseUrl = baseUrl;
    this.bearerToken = bearerToken;
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<PrometheusResponse<T>> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : undefined,
      });
    } catch (err) {
      logger.error({ err, url: url.toString() }, "Prometheus request failed");
      throw new ServiceUnavailableError("Could not reach the configured Prometheus endpoint");
    }

    const body = (await response.json().catch(() => null)) as PrometheusResponse<T> | null;
    if (!response.ok || !body || body.status !== "success") {
      throw new ServiceUnavailableError(`Prometheus query failed: ${body?.error ?? response.statusText}`);
    }
    return body;
  }

  async queryRange(query: string, start: Date, end: Date, stepSeconds: number): Promise<MetricSeries[]> {
    const body = await this.request<PrometheusMatrixResult>("/api/v1/query_range", {
      query,
      start: String(toUnixSeconds(start)),
      end: String(toUnixSeconds(end)),
      step: String(stepSeconds),
    });

    return (body.data?.result ?? []).map((series) => ({
      labels: series.metric,
      points: series.values.map(([timestamp, value]) => ({
        timestamp: new Date(timestamp * 1000).toISOString(),
        value: Number(value),
      })),
    }));
  }

  async queryInstant(query: string): Promise<MetricPoint | null> {
    const body = await this.request<PrometheusVectorResult>("/api/v1/query", { query });
    const first = body.data?.result[0];
    if (!first) return null;
    const [timestamp, value] = first.value;
    return { timestamp: new Date(timestamp * 1000).toISOString(), value: Number(value) };
  }
}
