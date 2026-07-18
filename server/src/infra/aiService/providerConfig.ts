import type { User } from "@prisma/client";
import { decryptSecret } from "../crypto/secretBox.ts";

export interface AiProviderSelection {
  provider: "GEMINI" | "GROQ";
  /** Decrypted personal API key for `provider`, or null to use the server's
   * own default key for that provider (set via ai-service's .env). */
  apiKey: string | null;
}

/** Used where no specific user can be attributed (no triggeredById, or a
 * ToolContext built outside a live AI conversation). */
export const DEFAULT_AI_PROVIDER_CONFIG: AiProviderSelection = { provider: "GEMINI", apiKey: null };

/** Resolves which LLM provider and (optionally decrypted) API key a user's
 * AI requests should use. The key only ever exists in-process here, forwarded
 * once to the trusted internal ai-service - never logged, never returned to
 * the client. */
export function resolveAiProviderConfig(user: User): AiProviderSelection {
  const encrypted = user.aiProvider === "GROQ" ? user.encryptedGroqKey : user.encryptedGeminiKey;
  return {
    provider: user.aiProvider,
    apiKey: encrypted ? decryptSecret(encrypted) : null,
  };
}
