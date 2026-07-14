import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "../auth/context.ts";
import { registerEngineeringPrompts } from "../prompts/engineering.prompts.ts";
import { registerRepositoryResources } from "../resources/repository.resources.ts";
import { registerAnalysisTools } from "../tools/analysis.tools.ts";
import { registerChatTools } from "../tools/chat.tools.ts";
import { registerCodeTools } from "../tools/code.tools.ts";
import { registerGraphTools } from "../tools/graph.tools.ts";
import { registerRepositoryTools } from "../tools/repository.tools.ts";
import { registerSearchTools } from "../tools/search.tools.ts";
import { registerWorkflowTools } from "../tools/workflow.tools.ts";

const SERVER_VERSION = "0.1.0";

/** Builds a fresh McpServer bound to one resolved identity via closures - every
 * tool/resource/prompt registered here already knows which organization it's
 * scoped to, so no per-call auth threading is needed. stdio calls this once at
 * startup; the HTTP transport calls it once per new session. */
export function createServer(auth: AuthContext): McpServer {
  const server = new McpServer({ name: "engineerbrain", version: SERVER_VERSION });

  registerRepositoryResources(server, auth);
  registerEngineeringPrompts(server);

  registerRepositoryTools(server, auth);
  registerSearchTools(server, auth);
  registerCodeTools(server, auth);
  registerGraphTools(server, auth);
  registerAnalysisTools(server, auth);
  registerWorkflowTools(server, auth);
  registerChatTools(server, auth);

  return server;
}
