import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "../auth/context.ts";
import { backendRequest } from "../clients/backendClient.ts";
import { withToolErrorHandling } from "../middleware/errorMapper.ts";
import type { SearchResultDto } from "../types/backend.types.ts";

function formatResults(results: SearchResultDto[]): string {
  if (results.length === 0) {
    return "No matching code found for this query.";
  }

  return results
    .map(
      (r, i) =>
        `${i + 1}. ${r.repositoryName} - ${r.filePath}${r.symbolName ? ` (${r.symbolName})` : ""} [${r.kind}, score ${r.score.toFixed(3)}]\n${r.content}`,
    )
    .join("\n\n---\n\n");
}

export function registerSearchTools(server: McpServer, auth: AuthContext): void {
  server.registerTool(
    "search_repository",
    {
      title: "Semantic search (single repository)",
      description: "Semantic (vector) search over one repository's indexed code and docs. Use this to find where something is implemented, not just text-matched.",
      inputSchema: {
        repositoryId: z.string().describe("Repository UUID, as returned by list_repositories"),
        query: z.string().describe("Natural-language description of what you're looking for, e.g. \"JWT token verification\""),
      },
    },
    withToolErrorHandling("search_repository", async ({ repositoryId, query }: { repositoryId: string; query: string }) => {
      const results = await backendRequest<SearchResultDto[]>(`/organizations/${auth.organizationSlug}/repositories/${repositoryId}/search`, {
        bearerToken: auth.bearerToken,
        query: { q: query },
      });
      return { content: [{ type: "text", text: formatResults(results) }] };
    }),
  );

  server.registerTool(
    "search_organization",
    {
      title: "Semantic search (all repositories)",
      description: `Semantic (vector) search across every repository indexed in the "${auth.organizationName}" organization. Use this when you don't know which repository something lives in.`,
      inputSchema: {
        query: z.string().describe("Natural-language description of what you're looking for"),
      },
    },
    withToolErrorHandling("search_organization", async ({ query }: { query: string }) => {
      const results = await backendRequest<SearchResultDto[]>(`/organizations/${auth.organizationSlug}/search`, {
        bearerToken: auth.bearerToken,
        query: { q: query },
      });
      return { content: [{ type: "text", text: formatResults(results) }] };
    }),
  );
}
