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
      const errorBody = await response.text();
      throw new ServiceUnavailableError(`AI service request failed (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
