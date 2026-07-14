import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "../auth/context.ts";
import { BackendApiError, backendRequest } from "../clients/backendClient.ts";
import { withToolErrorHandling } from "../middleware/errorMapper.ts";
import type { FindingsPageDto, RepositoryAnalysisResponseDto } from "../types/backend.types.ts";

const CATEGORIES = ["QUALITY", "SECURITY", "PERFORMANCE", "ARCHITECTURE", "DEPENDENCY", "PATTERN", "SOLID"] as const;
const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const SCORE_FIELDS: { key: keyof RepositoryAnalysisResponseDto; label: string }[] = [
  { key: "overallScore", label: "Overall" },
  { key: "architectureScore", label: "Architecture" },
  { key: "securityScore", label: "Security" },
  { key: "performanceScore", label: "Performance" },
  { key: "maintainabilityScore", label: "Maintainability" },
  { key: "scalabilityScore", label: "Scalability" },
  { key: "modularityScore", label: "Modularity" },
  { key: "layeringScore", label: "Layering" },
  { key: "documentationScore", label: "Documentation" },
  { key: "complexityScore", label: "Complexity" },
  { key: "technicalDebtScore", label: "Technical debt" },
];

export function registerAnalysisTools(server: McpServer, auth: AuthContext): void {
  server.registerTool(
    "repository_health",
    {
      title: "Repository health scores",
      description:
        "Returns the latest completed analysis's scores (0-100) for architecture, security, performance, maintainability, scalability, modularity, layering, documentation, complexity, and technical debt, plus a written architecture summary. This is the single source for \"how healthy/complex/in-debt is this repo\" questions - pair with list_findings for the specific issues behind a low score.",
      inputSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    withToolErrorHandling("repository_health", async ({ repositoryId }: { repositoryId: string }) => {
      const base = `/organizations/${auth.organizationSlug}/repositories/${repositoryId}/analysis`;

      let analysis: RepositoryAnalysisResponseDto;
      try {
        analysis = await backendRequest<RepositoryAnalysisResponseDto>(base, { bearerToken: auth.bearerToken });
      } catch (err) {
        if (err instanceof BackendApiError && err.statusCode === 404) {
          return {
            content: [
              {
                type: "text",
                text: "No completed health analysis exists yet for this repository. Run one with run_engineering_workflow (workflowKey: \"architecture-review\").",
              },
            ],
          };
        }
        throw err;
      }

      const scores = SCORE_FIELDS.map((f) => `${f.label}: ${analysis[f.key] ?? "n/a"}`).join("\n");
      const summary = analysis.architectureSummary ? `\n\nArchitecture summary:\n${analysis.architectureSummary}` : "";

      return {
        content: [{ type: "text", text: `Analysis completed ${analysis.completedAt ?? analysis.startedAt}\n\n${scores}${summary}` }],
      };
    }),
  );

  server.registerTool(
    "list_findings",
    {
      title: "List analysis findings",
      description:
        `Lists specific findings from the latest analysis, optionally filtered by category (${CATEGORIES.join(", ")}) and/or severity (${SEVERITIES.join(", ")}). ` +
        "Use category SECURITY for a security audit, PERFORMANCE for performance issues, PATTERN for detected design patterns, SOLID for SOLID-principle violations, DEPENDENCY for dependency issues, QUALITY for general code-quality issues (including likely dead code).",
      inputSchema: {
        repositoryId: z.string().describe("Repository UUID"),
        category: z.enum(CATEGORIES).optional(),
        severity: z.enum(SEVERITIES).optional(),
        pageSize: z.number().int().min(1).max(100).default(20).describe("Max findings to return"),
      },
    },
    withToolErrorHandling(
      "list_findings",
      async ({ repositoryId, category, severity, pageSize }: { repositoryId: string; category?: string; severity?: string; pageSize: number }) => {
        const page = await backendRequest<FindingsPageDto>(`/organizations/${auth.organizationSlug}/repositories/${repositoryId}/analysis/findings`, {
          bearerToken: auth.bearerToken,
          query: { category, severity, pageSize },
        });

        if (page.items.length === 0) {
          return { content: [{ type: "text", text: "No findings match these filters." }] };
        }

        const text = page.items
          .map(
            (f) =>
              `[${f.severity}${f.priority && f.priority !== f.severity ? `/priority ${f.priority}` : ""}] ${f.category} - ${f.title}` +
              `${f.filePath ? `\n  ${f.filePath}${f.startLine ? `:${f.startLine}` : ""}` : ""}\n  ${f.explanation}` +
              `${f.suggestedFix ? `\n  Suggested fix: ${f.suggestedFix}` : ""}`,
          )
          .join("\n\n");

        return {
          content: [{ type: "text", text: `${page.pageInfo.totalCount} finding(s) total, showing ${page.items.length}:\n\n${text}` }],
        };
      },
    ),
  );
}
