import { env } from "../config/env.ts";

export class BackendApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, message: string, code: string) {
    super(message);
    this.name = "BackendApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface BackendSuccessEnvelope<T> {
  success: true;
  data: T;
}

interface BackendErrorEnvelope {
  success: false;
  error: { message: string; code: string };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  bearerToken: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${env.ENGINEERBRAIN_API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Every backend call in this server goes through here - one place that
 * injects the caller's bearer token and turns the backend's {success:false}
 * envelope into a typed, catchable error. No tool talks to fetch() directly. */
export async function backendRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${options.bearerToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const envelope = (await response.json().catch(() => null)) as BackendSuccessEnvelope<T> | BackendErrorEnvelope | null;

  if (!envelope || !response.ok || !envelope.success) {
    const message = envelope && "error" in envelope ? envelope.error.message : `Backend request failed with status ${response.status}`;
    const code = envelope && "error" in envelope ? envelope.error.code : "UNKNOWN_ERROR";
    throw new BackendApiError(response.status, message, code);
  }

  return envelope.data;
}
