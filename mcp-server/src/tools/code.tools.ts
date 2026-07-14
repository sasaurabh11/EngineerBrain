import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "../auth/context.ts";
import { backendRequest } from "../clients/backendClient.ts";
import { withToolErrorHandling } from "../middleware/errorMapper.ts";
import type {
  CodeSymbolResponseDto,
  FileContentResponseDto,
  RepositoryFileResponseDto,
  SymbolSourceResult,
} from "../types/backend.types.ts";

function repoPath(auth: AuthContext, repositoryId: string): string {
  return `/organizations/${auth.organizationSlug}/repositories/${repositoryId}`;
}

function formatSymbols(symbols: CodeSymbolResponseDto[], label: string): string {
  if (symbols.length === 0) {
    return `No ${label} found in this repository's index.`;
  }
  return symbols.map((s) => `${s.name} - ${s.filePath}:${s.startLine}-${s.endLine}${s.signature ? ` - ${s.signature}` : ""}`).join("\n");
}

export function registerCodeTools(server: McpServer, auth: AuthContext): void {
  server.registerTool(
    "list_files",
    {
      title: "List indexed files",
      description: "Lists every file the indexer parsed for a repository, with language and line-count metadata (not file content - use get_file for that).",
      inputSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    withToolErrorHandling("list_files", async ({ repositoryId }: { repositoryId: string }) => {
      const files = await backendRequest<RepositoryFileResponseDto[]>(`${repoPath(auth, repositoryId)}/files`, { bearerToken: auth.bearerToken });
      const text = files.length === 0 ? "This repository hasn't been indexed yet." : files.map((f) => `${f.path} (${f.language}, ${f.linesOfCode} LOC)`).join("\n");
      return { content: [{ type: "text", text }] };
    }),
  );

  server.registerTool(
    "list_classes",
    {
      title: "List indexed classes/interfaces",
      description: "Lists every class and interface the indexer found in a repository, with file location and signature.",
      inputSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    withToolErrorHandling("list_classes", async ({ repositoryId }: { repositoryId: string }) => {
      const symbols = await backendRequest<CodeSymbolResponseDto[]>(`${repoPath(auth, repositoryId)}/classes`, { bearerToken: auth.bearerToken });
      return { content: [{ type: "text", text: formatSymbols(symbols, "classes or interfaces") }] };
    }),
  );

  server.registerTool(
    "list_functions",
    {
      title: "List indexed functions/methods",
      description: "Lists every function and method the indexer found in a repository, with file location and signature.",
      inputSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    withToolErrorHandling("list_functions", async ({ repositoryId }: { repositoryId: string }) => {
      const symbols = await backendRequest<CodeSymbolResponseDto[]>(`${repoPath(auth, repositoryId)}/functions`, { bearerToken: auth.bearerToken });
      return { content: [{ type: "text", text: formatSymbols(symbols, "functions or methods") }] };
    }),
  );

  server.registerTool(
    "get_file",
    {
      title: "Get file content",
      description: "Returns a repository file's full source content at its current default-branch state.",
      inputSchema: {
        repositoryId: z.string().describe("Repository UUID"),
        path: z.string().describe("File path relative to the repository root, e.g. \"src/index.ts\""),
      },
    },
    withToolErrorHandling("get_file", async ({ repositoryId, path }: { repositoryId: string; path: string }) => {
      const file = await backendRequest<FileContentResponseDto>(`${repoPath(auth, repositoryId)}/file-content`, {
        bearerToken: auth.bearerToken,
        query: { path },
      });
      return { content: [{ type: "text", text: file.content }] };
    }),
  );

  server.registerTool(
    "find_symbol_source",
    {
      title: "Find a function or class's source",
      description: "Looks up a function, method, class, or interface by name and returns its full source code, signature, doc comment, and file location. Use get_class/get_function-style lookups here.",
      inputSchema: {
        repositoryId: z.string().describe("Repository UUID"),
        name: z.string().describe("Symbol name to search for (case-insensitive, partial matches allowed)"),
        kind: z.enum(["class", "function"]).optional().describe("Narrow the search to classes/interfaces or functions/methods; omit to search both"),
      },
    },
    withToolErrorHandling(
      "find_symbol_source",
      async ({ repositoryId, name, kind }: { repositoryId: string; name: string; kind?: "class" | "function" }) => {
        const result = await backendRequest<SymbolSourceResult>(`${repoPath(auth, repositoryId)}/symbols/source`, {
          bearerToken: auth.bearerToken,
          query: { name, kind },
        });

        if (!result.found) {
          return { content: [{ type: "text", text: result.message }] };
        }

        const text = result.matches
          .map(
            (m) =>
              `${m.name} (${m.kind}) - ${m.filePath}:${m.startLine}-${m.endLine}\n${m.signature ?? ""}${m.docComment ? `\n${m.docComment}` : ""}\n\n${m.source}${m.truncated ? "\n\n[truncated]" : ""}`,
          )
          .join("\n\n---\n\n");

        return { content: [{ type: "text", text }] };
      },
    ),
  );
}
