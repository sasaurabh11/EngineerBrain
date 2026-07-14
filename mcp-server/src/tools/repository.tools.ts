import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "../auth/context.ts";
import { backendRequest } from "../clients/backendClient.ts";
import { withToolErrorHandling } from "../middleware/errorMapper.ts";
import type { RepositoryIndexResponseDto, RepositoryResponseDto } from "../types/backend.types.ts";

export function registerRepositoryTools(server: McpServer, auth: AuthContext): void {
  server.registerTool(
    "list_repositories",
    {
      title: "List repositories",
      description: `Lists every repository imported into the "${auth.organizationName}" organization, with its sync status, primary language, and star count.`,
      inputSchema: {},
    },
    withToolErrorHandling("list_repositories", async () => {
      const repositories = await backendRequest<RepositoryResponseDto[]>(`/organizations/${auth.organizationSlug}/repositories`, {
        bearerToken: auth.bearerToken,
      });

      if (repositories.length === 0) {
        return { content: [{ type: "text", text: "No repositories have been imported into this organization yet." }] };
      }

      const lines = repositories.map(
        (repo) =>
          `- ${repo.fullName} (id: ${repo.id}) - ${repo.primaryLanguage ?? "unknown language"}, ` +
          `${repo.starsCount} stars, sync status: ${repo.syncStatus}`,
      );

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }),
  );

  server.registerTool(
    "repository_summary",
    {
      title: "Repository summary",
      description: "Returns a repository's metadata (visibility, default branch, language, size) plus its indexing status (files, symbols, detected frameworks).",
      inputSchema: {
        repositoryId: z.string().describe("Repository UUID, as returned by list_repositories"),
      },
    },
    withToolErrorHandling("repository_summary", async ({ repositoryId }: { repositoryId: string }) => {
      const path = `/organizations/${auth.organizationSlug}/repositories/${repositoryId}`;
      const [repo, index] = await Promise.all([
        backendRequest<RepositoryResponseDto>(path, { bearerToken: auth.bearerToken }),
        backendRequest<RepositoryIndexResponseDto>(`${path}/index/status`, { bearerToken: auth.bearerToken }),
      ]);

      const summary = [
        `${repo.fullName} - ${repo.description ?? "no description"}`,
        `Visibility: ${repo.visibility} | Default branch: ${repo.defaultBranch} | Primary language: ${repo.primaryLanguage ?? "unknown"}`,
        `Stars: ${repo.starsCount} | Forks: ${repo.forksCount} | Open issues: ${repo.openIssuesCount} | Size: ${repo.sizeKb} KB`,
        `Sync status: ${repo.syncStatus}${repo.lastSyncedAt ? ` (last synced ${repo.lastSyncedAt})` : ""}`,
        `Index status: ${index.status}${index.lastIndexedAt ? ` (last indexed ${index.lastIndexedAt})` : ""}`,
        `Indexed: ${index.totalFiles} files, ${index.totalSymbols} symbols, ${index.totalChunks} chunks`,
        `Detected frameworks: ${index.detectedFrameworks.length > 0 ? index.detectedFrameworks.join(", ") : "none detected"}`,
      ].join("\n");

      return { content: [{ type: "text", text: summary }] };
    }),
  );
}
