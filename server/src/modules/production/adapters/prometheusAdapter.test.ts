import { afterEach, describe, expect, it, vi } from "vitest";
import { PrometheusMetricsAdapter } from "./prometheusAdapter.ts";

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      statusText: ok ? "OK" : "Internal Server Error",
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PrometheusMetricsAdapter", () => {
  it("parses a matrix response from query_range into MetricSeries", async () => {
    mockFetchOnce({
      status: "success",
      data: {
        resultType: "matrix",
        result: [
          {
            metric: { __name__: "http_errors_total", service: "checkout" },
            values: [
              [1000, "1"],
              [1010, "3"],
            ],
          },
        ],
      },
    });

    const adapter = new PrometheusMetricsAdapter("http://prom.internal:9090");
    const series = await adapter.queryRange("http_errors_total", new Date(0), new Date(20_000), 10);

    expect(series).toHaveLength(1);
    expect(series[0]!.labels).toEqual({ __name__: "http_errors_total", service: "checkout" });
    expect(series[0]!.points).toEqual([
      { timestamp: new Date(1000 * 1000).toISOString(), value: 1 },
      { timestamp: new Date(1010 * 1000).toISOString(), value: 3 },
    ]);
  });

  it("parses a vector response from query into a single MetricPoint", async () => {
    mockFetchOnce({
      status: "success",
      data: { resultType: "vector", result: [{ metric: {}, value: [1500, "0.42"] }] },
    });

    const adapter = new PrometheusMetricsAdapter("http://prom.internal:9090");
    const point = await adapter.queryInstant("error_rate");

    expect(point).toEqual({ timestamp: new Date(1500 * 1000).toISOString(), value: 0.42 });
  });

  it("returns null for queryInstant when there is no result", async () => {
    mockFetchOnce({ status: "success", data: { resultType: "vector", result: [] } });

    const adapter = new PrometheusMetricsAdapter("http://prom.internal:9090");
    const point = await adapter.queryInstant("nonexistent_metric");

    expect(point).toBeNull();
  });

  it("throws a ServiceUnavailableError-shaped error when Prometheus returns an error status", async () => {
    mockFetchOnce({ status: "error", error: "bad query" });

    const adapter = new PrometheusMetricsAdapter("http://prom.internal:9090");
    await expect(adapter.queryInstant("invalid{")).rejects.toThrow(/bad query/);
  });

  it("sends the bearer token when configured", async () => {
    mockFetchOnce({ status: "success", data: { resultType: "vector", result: [] } });
    const adapter = new PrometheusMetricsAdapter("http://prom.internal:9090", "secret-token");

    await adapter.queryInstant("up");

    const [, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });
});
