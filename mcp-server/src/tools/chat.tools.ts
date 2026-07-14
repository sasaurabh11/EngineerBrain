import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "../auth/context.ts";
import { backendRequest } from "../clients/backendClient.ts";
import { streamChatMessage } from "../clients/chatStreamClient.ts";
import { withToolErrorHandling } from "../middleware/errorMapper.ts";
import type { Citation, ConversationResponseDto } from "../types/backend.types.ts";

export function registerChatTools(server: McpServer, auth: AuthContext): void {
  server.registerTool(
    "ask_repository",
    {
      title: "Ask the AI assistant about a repository",
      description:
        "Asks EngineerBrain's own retrieval-grounded AI assistant a question and returns its answer with file citations. " +
        "Prefer this over search_repository when you want a synthesized answer rather than raw search results - it runs its own retrieval and reasoning internally.",
      inputSchema: {
        question: z.string().describe("The question to ask"),
        repositoryId: z.string().optional().describe("Scope the question to one repository; omit to search across the whole organization"),
      },
    },
    withToolErrorHandling("ask_repository", async ({ question, repositoryId }: { question: string; repositoryId?: string }) => {
      const conversation = await backendRequest<ConversationResponseDto>(`/organizations/${auth.organizationSlug}/ai/conversations`, {
        method: "POST",
        bearerToken: auth.bearerToken,
        body: repositoryId ? { repositoryId } : {},
      });

      let answer = "";
      let citations: Citation[] = [];

      for await (const event of streamChatMessage(auth.organizationSlug, conversation.id, question, auth.bearerToken)) {
        if (event.type === "text-delta") {
          answer += event.text;
        } else if (event.type === "done") {
          citations = event.citations;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }

      const citationText = citations.length > 0 ? `\n\nSources:\n${citations.map((c) => `- ${c.filePath}`).join("\n")}` : "";

      return { content: [{ type: "text", text: `${answer}${citationText}` }] };
    }),
  );
}
