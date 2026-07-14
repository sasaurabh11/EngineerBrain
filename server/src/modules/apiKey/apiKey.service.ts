import crypto from "node:crypto";
import { NotFoundError, UnauthorizedError } from "../../common/errors/AppError.ts";
import { apiKeyRepository } from "./apiKey.repository.ts";
import type { ApiKeyResponseDto, CreatedApiKeyResponseDto, ResolvedApiKeyIdentity } from "./apiKey.types.ts";

export const API_KEY_PREFIX = "eb_live_";
const RAW_KEY_BYTES = 32;
const PREFIX_DISPLAY_CHARS = 12;

type ApiKeyWithCreator = NonNullable<Awaited<ReturnType<typeof apiKeyRepository.create>>>;

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function toResponse(apiKey: ApiKeyWithCreator): ApiKeyResponseDto {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    lastUsedAt: apiKey.lastUsedAt,
    revokedAt: apiKey.revokedAt,
    createdAt: apiKey.createdAt,
    createdBy: {
      id: apiKey.createdBy.id,
      name: apiKey.createdBy.name,
      email: apiKey.createdBy.email,
    },
  };
}

export const apiKeyService = {
  async list(organizationId: string): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await apiKeyRepository.listActiveByOrg(organizationId);
    return apiKeys.map(toResponse);
  },

  async create(organizationId: string, createdById: string, name: string): Promise<CreatedApiKeyResponseDto> {
    const rawKey = `${API_KEY_PREFIX}${crypto.randomBytes(RAW_KEY_BYTES).toString("hex")}`;
    const apiKey = await apiKeyRepository.create({
      organizationId,
      createdById,
      name,
      keyPrefix: rawKey.slice(0, PREFIX_DISPLAY_CHARS),
      hashedKey: hashKey(rawKey),
    });

    return { ...toResponse(apiKey), key: rawKey };
  },

  async revoke(organizationId: string, apiKeyId: string): Promise<void> {
    const apiKey = await apiKeyRepository.findById(apiKeyId);
    if (!apiKey || apiKey.organizationId !== organizationId) {
      throw new NotFoundError("API key not found");
    }
    if (apiKey.revokedAt) {
      return;
    }
    await apiKeyRepository.revoke(apiKeyId);
  },

  /** Resolves a raw bearer credential to the identity requireOrgRole expects.
   * Called from auth.middleware.ts before Clerk verification is attempted. */
  async verify(rawKey: string): Promise<ResolvedApiKeyIdentity> {
    const apiKey = await apiKeyRepository.findActiveByHashedKey(hashKey(rawKey));
    if (!apiKey) {
      throw new UnauthorizedError("Invalid or revoked API key");
    }

    void apiKeyRepository.touchLastUsed(apiKey.id);

    return { user: apiKey.createdBy, organizationId: apiKey.organizationId };
  },
};
