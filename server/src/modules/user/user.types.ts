import type { AiProvider, OrgRole } from "@prisma/client";

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Present only when authenticated via an org-scoped API key (see apiKey module) -
   * tells a non-interactive client (the MCP server) which single organization it's
   * scoped to, since it has no other way to discover its own orgSlug. */
  apiKeyOrganization?: {
    id: string;
    slug: string;
    name: string;
    role: OrgRole;
  } | null;
  aiProvider: AiProvider;
  /** Whether a personal key is stored for each provider - never the key itself. */
  hasGeminiKey: boolean;
  hasGroqKey: boolean;
}

export interface UpdateAiSettingsInput {
  provider?: AiProvider;
  /** undefined = leave unchanged, null = remove the stored key, string = set a new key. */
  geminiApiKey?: string | null;
  groqApiKey?: string | null;
}
