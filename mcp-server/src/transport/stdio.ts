import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveIdentity } from "../auth/apiKeyAuth.ts";
import { env } from "../config/env.ts";
import { logger } from "../logging/logger.ts";
import { createServer } from "../server/createServer.ts";

/** One process = one identity. Resolved once at startup and closed over by
 * every tool for the process's lifetime - unlike the HTTP transport, stdio
 * has no per-request notion of "which caller", so there's nothing to thread
 * per call. */
export async function startStdioTransport(): Promise<void> {
  if (!env.ENGINEERBRAIN_API_KEY) {
    logger.error("ENGINEERBRAIN_API_KEY is required when MCP_TRANSPORT=stdio");
    process.exit(1);
  }

  const auth = await resolveIdentity(env.ENGINEERBRAIN_API_KEY);
  logger.info({ organization: auth.organizationSlug, user: auth.userEmail }, "Resolved identity for stdio transport");

  const server = createServer(auth);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP server connected over stdio");
}
