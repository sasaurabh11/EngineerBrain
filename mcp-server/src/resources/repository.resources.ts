import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "../auth/context.ts";
import { BackendApiError, backendRequest } from "../clients/backendClient.ts";
import type {
  FindingsPageDto,
  RepositoryAnalysisResponseDto,
  RepositoryIndexResponseDto,
  RepositoryResponseDto,
} from "../types/backend.types.ts";

function textContents(uri: string, text: string) {
  return { contents: [{ uri, mimeType: "text/plain", text }] };
}

export function registerRepositoryResources(server: McpServer, auth: AuthContext): void {
  server.registerResource(
    "repositories",
    "engineerbrain://repositories",
    { title: "Repositories", description: `Every repository imported into the "${auth.organizationName}" organization.`, mimeType: "text/plain" },
    async (uri) => {
      const repositories = await backendRequest<RepositoryResponseDto[]>(`/organizations/${auth.organizationSlug}/repositories`, {
        bearerToken: auth.bearerToken,
      });
      const text = repositories.map((r) => `${r.id}\t${r.fullName}\t${r.primaryLanguage ?? "unknown"}\t${r.syncStatus}`).join("\n");
      return textContents(uri.href, text || "No repositories imported yet.");
    },
  );

  server.registerResource(
    "repository-summary",
    new ResourceTemplate("engineerbrain://repositories/{repositoryId}", { list: undefined }),
    { title: "Repository summary", description: "A repository's metadata plus its indexing status.", mimeType: "text/plain" },
    async (uri, { repositoryId }) => {
      const id = Array.isArray(repositoryId) ? repositoryId[0]! : repositoryId;
      const path = `/organizations/${auth.organizationSlug}/repositories/${id}`;
      const [repo, index] = await Promise.all([
        backendRequest<RepositoryResponseDto>(path, { bearerToken: auth.bearerToken }),
        backendRequest<RepositoryIndexResponseDto>(`${path}/index/status`, { bearerToken: auth.bearerToken }),
      ]);

      const text = [
        `${repo.fullName} - ${repo.description ?? "no description"}`,
        `Visibility: ${repo.visibility} | Default branch: ${repo.defaultBranch} | Language: ${repo.primaryLanguage ?? "unknown"}`,
        `Index status: ${index.status} | Files: ${index.totalFiles} | Symbols: ${index.totalSymbols}`,
        `Detected frameworks: ${index.detectedFrameworks.join(", ") || "none"}`,
      ].join("\n");

      return textContents(uri.href, text);
    },
  );

  server.registerResource(
    "repository-health",
    new ResourceTemplate("engineerbrain://repositories/{repositoryId}/health", { list: undefined }),
    { title: "Repository health", description: "The latest completed analysis's scores and architecture summary.", mimeType: "text/plain" },
    async (uri, { repositoryId }) => {
      const id = Array.isArray(repositoryId) ? repositoryId[0]! : repositoryId;
      try {
        const analysis = await backendRequest<RepositoryAnalysisResponseDto>(
          `/organizations/${auth.organizationSlug}/repositories/${id}/analysis`,
          { bearerToken: auth.bearerToken },
        );
        const text = [
          `Overall: ${analysis.overallScore ?? "n/a"} | Security: ${analysis.securityScore ?? "n/a"} | Performance: ${analysis.performanceScore ?? "n/a"}`,
          `Maintainability: ${analysis.maintainabilityScore ?? "n/a"} | Technical debt: ${analysis.technicalDebtScore ?? "n/a"}`,
          analysis.architectureSummary ?? "",
        ].join("\n");
        return textContents(uri.href, text);
      } catch (err) {
        if (err instanceof BackendApiError && err.statusCode === 404) {
          return textContents(uri.href, "No completed analysis exists yet for this repository.");
        }
        throw err;
      }
    },
  );

  server.registerResource(
    "repository-findings",
    new ResourceTemplate("engineerbrain://repositories/{repositoryId}/findings", { list: undefined }),
    { title: "Repository findings", description: "Findings from the latest analysis (all categories/severities).", mimeType: "text/plain" },
    async (uri, { repositoryId }) => {
      const id = Array.isArray(repositoryId) ? repositoryId[0]! : repositoryId;
      const page = await backendRequest<FindingsPageDto>(`/organizations/${auth.organizationSlug}/repositories/${id}/analysis/findings`, {
        bearerToken: auth.bearerToken,
        query: { pageSize: 100 },
      });

      const text = page.items.map((f) => `[${f.severity}] ${f.category} - ${f.title}${f.filePath ? ` (${f.filePath})` : ""}`).join("\n");
      return textContents(uri.href, text || "No findings for this repository.");
    },
  );
}
