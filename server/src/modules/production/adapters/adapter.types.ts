/** Adapter interfaces for external production systems. Each interface is
 * implemented once per provider (see prometheusAdapter.ts,
 * githubActionsAdapter.ts) and selected by adapterFactory.ts based on a
 * ProductionIntegration's `provider`. The correlation engine and REST layer
 * only ever depend on these interfaces, never on a concrete provider -
 * adding Grafana/Loki, OpenTelemetry, Jaeger, Kubernetes, Datadog, etc.
 * later means implementing one of these interfaces, not touching the engine. */

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface MetricSeries {
  labels: Record<string, string>;
  points: MetricPoint[];
}

export interface MetricsAdapter {
  queryRange(query: string, start: Date, end: Date, stepSeconds: number): Promise<MetricSeries[]>;
  queryInstant(query: string): Promise<MetricPoint | null>;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  labels: Record<string, string>;
}

export interface LogsAdapter {
  search(query: string, start: Date, end: Date, limit: number): Promise<LogEntry[]>;
}

export interface TraceSummary {
  traceId: string;
  durationMs: number;
  startedAt: string;
  hasError: boolean;
}

export interface Trace {
  traceId: string;
  spans: { spanId: string; operationName: string; serviceName: string; durationMs: number; hasError: boolean }[];
}

export interface TracesAdapter {
  searchTraces(serviceName: string, start: Date, end: Date, limit: number): Promise<TraceSummary[]>;
  getTrace(traceId: string): Promise<Trace | null>;
}

export interface DeploymentEvent {
  sourceRunId: string;
  version: string;
  environment: string;
  status: "SUCCESS" | "FAILED" | "ROLLED_BACK" | "IN_PROGRESS";
  deployedAt: Date;
  commitSha: string | null;
  rawPayload: Record<string, unknown>;
}

export interface DeploymentAdapter {
  listRecentDeployments(since: Date): Promise<DeploymentEvent[]>;
}

export interface PodEvent {
  podName: string;
  namespace: string;
  reason: string;
  occurredAt: string;
}

export interface ClusterAdapter {
  listPodEvents(namespace: string, since: Date): Promise<PodEvent[]>;
}
