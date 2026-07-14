#!/usr/bin/env node
import { env } from "./config/env.ts";
import { logger } from "./logging/logger.ts";
import { startHttpTransport } from "./transport/http.ts";
import { startStdioTransport } from "./transport/stdio.ts";

async function main(): Promise<void> {
  if (env.MCP_TRANSPORT === "http") {
    await startHttpTransport();
  } else {
    await startStdioTransport();
  }
}

main().catch((err) => {
  logger.error({ err }, "Fatal error starting MCP server");
  process.exit(1);
});
