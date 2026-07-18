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
