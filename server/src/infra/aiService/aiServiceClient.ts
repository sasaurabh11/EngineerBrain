import { ServiceUnavailableError } from "../../common/errors/AppError.ts";
import { env } from "../../config/env.ts";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

interface AiServiceRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export function isAiServiceConfigured(): boolean {
  return Boolean(env.AI_SERVICE_API_KEY);
}

export async function callAiService<T>(path: string, options: AiServiceRequestOptions = {}): Promise<T> {
  if (!isAiServiceConfigured()) {
    throw new ServiceUnavailableError("AI service is not configured on this server");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: options.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": env.AI_SERVICE_API_KEY!,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawBody = await response.text();
      // ai-service returns structured {"detail": {"code", "message"}} for known
      // provider errors (rate limits, missing keys) - see app/core/errors.py.
      // Fall back to the raw body for anything else (framework error pages, etc).
      let message = rawBody || `AI service request failed (${response.status})`;
      let code: string | undefined;
      try {
        const detail = (JSON.parse(rawBody) as { detail?: unknown }).detail;
        if (detail && typeof detail === "object" && "message" in detail && typeof (detail as { message: unknown }).message === "string") {
          message = (detail as { code?: string; message: string }).message;
          code = (detail as { code?: string }).code;
        }
      } catch {
        // not JSON - keep the raw text as the message
      }
      throw new ServiceUnavailableError(message, code);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}

interface AiServiceStreamFrame {
  text?: string;
  done?: boolean;
  error?: { code?: string; message: string };
}

/** SSE variant of callAiService, for the one ai-service endpoint that streams
 * real token deltas (agent-step-stream) instead of a single JSON body. */
export async function* streamAiService(path: string, options: Pick<AiServiceRequestOptions, "body" | "signal"> = {}): AsyncGenerator<AiServiceStreamFrame> {
  if (!isAiServiceConfigured()) {
    throw new ServiceUnavailableError("AI service is not configured on this server");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": env.AI_SERVICE_API_KEY!,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const rawBody = await response.text().catch(() => "");
      throw new ServiceUnavailableError(rawBody || `AI service stream request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const raw of frames) {
        const line = raw.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        yield JSON.parse(line.slice("data: ".length)) as AiServiceStreamFrame;
      }
    }
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
