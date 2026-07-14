import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "../auth/context.ts";
import { backendRequest } from "../clients/backendClient.ts";
import { withToolErrorHandling } from "../middleware/errorMapper.ts";
import type { ApiEndpointResponseDto, CodeGraphEdgeResponseDto } from "../types/backend.types.ts";

export function registerGraphTools(server: McpServer, auth: AuthContext): void {
  server.registerTool(
    "dependency_graph",
    {
      title: "Dependency graph",
      description: "Returns the repository's code dependency graph as edges (imports, calls, extends, implements, uses, package dependencies) between symbols and files.",
      inputSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    withToolErrorHandling("dependency_graph", async ({ repositoryId }: { repositoryId: string }) => {
      const edges = await backendRequest<CodeGraphEdgeResponseDto[]>(
        `/organizations/${auth.organizationSlug}/repositories/${repositoryId}/graph`,
        { bearerToken: auth.bearerToken },
      );

      if (edges.length === 0) {
        return { content: [{ type: "text", text: "No dependency graph data - this repository may not be indexed yet." }] };
      }

      const text = edges
        .map((e) => `${e.sourceSymbolId} --${e.edgeType}--> ${e.targetSymbolId ?? e.targetPackageName ?? "unknown"}`)
        .join("\n");

      return { content: [{ type: "text", text: `${edges.length} dependency edges:\n${text}` }] };
    }),
  );

  server.registerTool(
    "find_endpoints",
    {
      title: "Find API endpoints",
      description: "Lists the HTTP API endpoints (route + method + framework) the indexer detected in a repository.",
      inputSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    withToolErrorHandling("find_endpoints", async ({ repositoryId }: { repositoryId: string }) => {
      const endpoints = await backendRequest<ApiEndpointResponseDto[]>(
        `/organizations/${auth.organizationSlug}/repositories/${repositoryId}/endpoints`,
        { bearerToken: auth.bearerToken },
      );

      const text =
        endpoints.length === 0
          ? "No API endpoints detected in this repository."
          : endpoints.map((e) => `${e.method} ${e.path} - ${e.filePath} (${e.framework})`).join("\n");

      return { content: [{ type: "text", text }] };
    }),
  );
}
