import type { User } from "@prisma/client";

export interface ApiKeyResponseDto {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreatedApiKeyResponseDto extends ApiKeyResponseDto {
  /** The full bearer credential - only ever returned once, at creation time. */
  key: string;
}

export interface CreateApiKeyInput {
  name: string;
}

export interface ResolvedApiKeyIdentity {
  user: User;
  organizationId: string;
}
