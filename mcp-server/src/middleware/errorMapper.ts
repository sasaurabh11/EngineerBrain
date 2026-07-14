import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BackendApiError } from "../clients/backendClient.ts";
import { logger } from "../logging/logger.ts";

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], isError };
}

/** Wraps a tool handler so a thrown error becomes a normal CallToolResult with
 * isError: true - the MCP-recommended way to report a failed-but-handled tool
 * call, so the calling model sees the message instead of a raw protocol error. */
export function withToolErrorHandling<Args extends unknown[]>(
  toolName: string,
  handler: (...args: Args) => Promise<CallToolResult>,
): (...args: Args) => Promise<CallToolResult> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof BackendApiError) {
        logger.warn({ toolName, statusCode: err.statusCode, code: err.code }, "Tool call failed against backend");
        return textResult(`${err.message} (${err.code})`, true);
      }

      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ toolName, err }, "Tool call failed unexpectedly");
      return textResult(message, true);
    }
  };
}
