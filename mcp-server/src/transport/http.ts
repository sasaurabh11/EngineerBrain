import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response } from "express";
import { resolveIdentity } from "../auth/apiKeyAuth.ts";
import type { AuthContext } from "../auth/context.ts";
import { env } from "../config/env.ts";
import { logger } from "../logging/logger.ts";
import { createServer } from "../server/createServer.ts";

const sessions = new Map<string, StreamableHTTPServerTransport>();

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"];

  if (typeof sessionId === "string") {
    const existing = sessions.get(sessionId);
    if (!existing) {
      res.status(404).json({ error: "Unknown or expired session" });
      return;
    }
    await existing.handleRequest(req, res, req.body);
    return;
  }

  if (!isInitializeRequest(req.body)) {
    res.status(400).json({ error: "First request on a new connection must be an MCP initialize request" });
    return;
  }

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) {
    res.status(401).json({ error: "Missing Authorization: Bearer <api-key> header" });
    return;
  }

  let auth: AuthContext;
  try {
    auth = await resolveIdentity(bearerToken);
  } catch (err) {
    logger.warn({ err }, "Rejected MCP session - invalid credential");
    res.status(401).json({ error: err instanceof Error ? err.message : "Invalid credential" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, transport);
      logger.info({ sessionId: id, organization: auth.organizationSlug }, "MCP session initialized");
    },
    onsessionclosed: (id) => {
      sessions.delete(id);
      logger.info({ sessionId: id }, "MCP session closed");
    },
  });

  const server = createServer(auth);
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

export async function startHttpTransport(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", (req, res) => {
    handleMcpRequest(req, res).catch((err) => {
      logger.error({ err }, "Unhandled error in POST /mcp");
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    });
  });

  // Server-initiated notifications stream (spec-optional, same session map).
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    const transport = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;
    if (!transport) {
      res.status(404).json({ error: "Unknown or expired session" });
      return;
    }
    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    const transport = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;
    if (!transport) {
      res.status(404).json({ error: "Unknown or expired session" });
      return;
    }
    await transport.handleRequest(req, res);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", activeSessions: sessions.size });
  });

  app.listen(env.MCP_HTTP_PORT, () => {
    logger.info({ port: env.MCP_HTTP_PORT }, "MCP server listening over Streamable HTTP");
  });
}
