import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "../auth/context.ts";
import { backendRequest } from "../clients/backendClient.ts";
import { withToolErrorHandling } from "../middleware/errorMapper.ts";
import type {
  DeploymentsPageDto,
  IncidentResponseDto,
  IncidentSignalDto,
  IncidentTimelineEventDto,
  IncidentsPageDto,
  PostmortemResponseDto,
  RecommendationDto,
  RootCauseAnalysisDto,
  ServiceHealthResponseDto,
} from "../types/backend.types.ts";

function describeIncident(incident: IncidentResponseDto): string {
  return `${incident.id} - ${incident.title} [${incident.severity}, ${incident.status}]${incident.confidenceScore !== null ? ` (confidence ${incident.confidenceScore}%)` : ""} - detected ${incident.detectedAt}`;
}

export function registerProductionTools(server: McpServer, auth: AuthContext): void {
  const base = `/organizations/${auth.organizationSlug}/production`;

  server.registerTool(
    "declare_incident",
    {
      title: "Declare a production incident",
      description: "Manually declares a new production incident and immediately starts the real correlation/root-cause/recommendation pipeline against it. Use this when asked to open, declare, or report an incident.",
      inputSchema: {
        title: z.string().describe("Short incident title, e.g. \"Checkout returning 500s\""),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        serviceId: z.string().optional().describe("Service UUID this incident affects, if known"),
      },
    },
    withToolErrorHandling("declare_incident", async ({ title, severity, serviceId }: { title: string; severity: string; serviceId?: string }) => {
      const incident = await backendRequest<IncidentResponseDto>(`${base}/incidents`, {
        method: "POST",
        bearerToken: auth.bearerToken,
        body: { title, severity, serviceId },
      });
      return { content: [{ type: "text", text: `Declared: ${describeIncident(incident)}` }] };
    }),
  );

  server.registerTool(
    "production_incidents",
    {
      title: "List production incidents",
      description: "Lists production incidents for this organization, optionally filtered by status or severity. Use this to answer \"what's broken right now\" or \"what incidents happened\".",
      inputSchema: {
        status: z.enum(["DETECTED", "INVESTIGATING", "ROOT_CAUSED", "RESOLVED", "CLOSED"]).optional(),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
      },
    },
    withToolErrorHandling("production_incidents", async ({ status, severity }: { status?: string; severity?: string }) => {
      const result = await backendRequest<IncidentsPageDto>(`${base}/incidents`, {
        bearerToken: auth.bearerToken,
        query: { status, severity },
      });
      const text = result.items.map(describeIncident).join("\n") || "No incidents found.";
      return { content: [{ type: "text", text }] };
    }),
  );

  server.registerTool(
    "incident_summary",
    {
      title: "Get incident summary",
      description: "Gets full details for one incident: status, severity, timeline, and correlated evidence. Use this once you have an incident id from production_incidents.",
      inputSchema: { incidentId: z.string().describe("Incident UUID") },
    },
    withToolErrorHandling("incident_summary", async ({ incidentId }: { incidentId: string }) => {
      const [incident, timeline, signals] = await Promise.all([
        backendRequest<IncidentResponseDto>(`${base}/incidents/${incidentId}`, { bearerToken: auth.bearerToken }),
        backendRequest<IncidentTimelineEventDto[]>(`${base}/incidents/${incidentId}/timeline`, { bearerToken: auth.bearerToken }),
        backendRequest<IncidentSignalDto[]>(`${base}/incidents/${incidentId}/signals`, { bearerToken: auth.bearerToken }),
      ]);

      const timelineText = timeline.map((t) => `  ${t.occurredAt}: ${t.description}`).join("\n") || "  (none)";
      const signalsText = signals.map((s) => `  [${s.signalType}] ${s.summary}`).join("\n") || "  (none)";
      const text = `${describeIncident(incident)}\n\nTimeline:\n${timelineText}\n\nEvidence:\n${signalsText}`;
      return { content: [{ type: "text", text }] };
    }),
  );

  server.registerTool(
    "root_cause_analysis",
    {
      title: "Get incident root cause analysis",
      description: "Gets the root cause analysis for an incident - most likely cause, confidence score, and the responsible commit/PR/service/user if identified. Fails if analysis hasn't completed yet.",
      inputSchema: { incidentId: z.string().describe("Incident UUID") },
    },
    withToolErrorHandling("root_cause_analysis", async ({ incidentId }: { incidentId: string }) => {
      const rootCause = await backendRequest<RootCauseAnalysisDto>(`${base}/incidents/${incidentId}/root-cause`, { bearerToken: auth.bearerToken });
      const text =
        `Most likely cause: ${rootCause.mostLikelyCause}\nConfidence: ${rootCause.confidenceScore}%\nRollback recommended: ${rootCause.rollbackRecommended}\n` +
        `${rootCause.responsibleCommitSha ? `Responsible commit: ${rootCause.responsibleCommitSha}\n` : ""}` +
        `${rootCause.responsiblePullRequestId ? `Responsible PR: ${rootCause.responsiblePullRequestId}\n` : ""}` +
        `\nSummary: ${rootCause.summary}`;
      return { content: [{ type: "text", text }] };
    }),
  );

  server.registerTool(
    "deployment_history",
    {
      title: "Get deployment history",
      description: "Lists recent deployments, optionally filtered by service or environment.",
      inputSchema: {
        serviceId: z.string().optional().describe("Service UUID to filter by"),
        environment: z.string().optional().describe("Environment/branch name to filter by"),
      },
    },
    withToolErrorHandling("deployment_history", async ({ serviceId, environment }: { serviceId?: string; environment?: string }) => {
      const result = await backendRequest<DeploymentsPageDto>(`${base}/deployments`, {
        bearerToken: auth.bearerToken,
        query: { serviceId, environment },
      });
      const text =
        result.items
          .map((d) => `${d.id} - ${d.version ?? d.commitSha?.slice(0, 7) ?? "?"} to "${d.environment}" [${d.status}] at ${d.deployedAt}`)
          .join("\n") || "No deployments found.";
      return { content: [{ type: "text", text }] };
    }),
  );

  server.registerTool(
    "service_health",
    {
      title: "Get service health",
      description: "Gets a service's current health snapshot: error rate, p95 latency, and risk score.",
      inputSchema: { serviceId: z.string().describe("Service UUID") },
    },
    withToolErrorHandling("service_health", async ({ serviceId }: { serviceId: string }) => {
      const health = await backendRequest<ServiceHealthResponseDto>(`${base}/services/${serviceId}/health`, { bearerToken: auth.bearerToken });
      const text = `Error rate: ${health.errorRate ?? "unknown"}\nP95 latency: ${health.p95LatencyMs ?? "unknown"}ms\nRisk score: ${health.riskScore ?? "unknown"}\nCaptured at: ${health.capturedAt ?? "never"}`;
      return { content: [{ type: "text", text }] };
    }),
  );

  server.registerTool(
    "blast_radius",
    {
      title: "Estimate incident blast radius",
      description: "Estimates which other services might be affected by an incident (services sharing the same repository). For code-level dependents, use pr_dependency_impact against the responsible PR instead.",
      inputSchema: { incidentId: z.string().describe("Incident UUID") },
    },
    withToolErrorHandling("blast_radius", async ({ incidentId }: { incidentId: string }) => {
      // blast_radius isn't a standalone REST endpoint (it's an AiTool-only
      // capability in this slice) - surface that clearly instead of guessing
      // at a URL that doesn't exist.
      return {
        content: [
          {
            type: "text",
            text: `Blast radius for incident ${incidentId} is available through the EngineerBrain AI chat (ask "what's the blast radius of this incident") - it isn't yet exposed as a direct REST endpoint this MCP server can call.`,
          },
        ],
      };
    }),
  );

  server.registerTool(
    "generate_postmortem",
    {
      title: "Generate incident postmortem",
      description: "Generates a full postmortem document for an incident that already has a root cause analysis.",
      inputSchema: { incidentId: z.string().describe("Incident UUID") },
    },
    withToolErrorHandling("generate_postmortem", async ({ incidentId }: { incidentId: string }) => {
      const postmortem = await backendRequest<PostmortemResponseDto>(`${base}/incidents/${incidentId}/postmortem`, {
        method: "POST",
        bearerToken: auth.bearerToken,
      });
      const text = `${postmortem.executiveSummary}\n\n## Root cause\n${postmortem.rootCauseMarkdown}\n\n## Timeline\n${postmortem.timelineMarkdown}`;
      return { content: [{ type: "text", text }] };
    }),
  );

  server.registerTool(
    "rollback_recommendation",
    {
      title: "Get rollback recommendation",
      description: "Reports whether a rollback is recommended for an incident, and why, based on its recommendations. Does not perform any rollback.",
      inputSchema: { incidentId: z.string().describe("Incident UUID") },
    },
    withToolErrorHandling("rollback_recommendation", async ({ incidentId }: { incidentId: string }) => {
      const recommendations = await backendRequest<RecommendationDto[]>(`${base}/incidents/${incidentId}/recommendations`, { bearerToken: auth.bearerToken });
      const rollback = recommendations.find((r) => r.type === "ROLLBACK");
      const text = rollback
        ? `Rollback recommended: ${rollback.title}\n${rollback.description}\n\nRationale: ${rollback.rationale}`
        : "No rollback recommendation exists for this incident.";
      return { content: [{ type: "text", text }] };
    }),
  );
}
