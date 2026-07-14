import { backendRequest } from "../clients/backendClient.ts";
import type { MeResponseDto } from "../types/backend.types.ts";
import type { AuthContext } from "./context.ts";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { context: AuthContext; expiresAt: number }>();

/** Resolves a raw bearer credential to the org identity every tool needs -
 * this server has no database access, so the backend's GET /me (enriched
 * with apiKeyOrganization for API-key auth - see server/user.service.ts)
 * is the only source of truth for "who is calling, and which org". */
export async function resolveIdentity(bearerToken: string): Promise<AuthContext> {
  const cached = cache.get(bearerToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  const me = await backendRequest<MeResponseDto>("/me", { bearerToken });

  if (!me.apiKeyOrganization) {
    throw new Error(
      "This credential isn't an EngineerBrain API key. Create one from an organization's Settings page and use it as the bearer token.",
    );
  }

  const context: AuthContext = {
    bearerToken,
    userId: me.id,
    userName: me.name,
    userEmail: me.email,
    organizationId: me.apiKeyOrganization.id,
    organizationSlug: me.apiKeyOrganization.slug,
    organizationName: me.apiKeyOrganization.name,
    role: me.apiKeyOrganization.role,
  };

  cache.set(bearerToken, { context, expiresAt: Date.now() + CACHE_TTL_MS });
  return context;
}
