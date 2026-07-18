import { clerkClient } from "@clerk/express";
import type { User } from "@prisma/client";
import { UnauthorizedError } from "../../common/errors/AppError.ts";
import { encryptSecret } from "../../infra/crypto/secretBox.ts";
import { memberRepository } from "../member/member.repository.ts";
import { organizationRepository } from "../organization/organization.repository.ts";
import { userRepository } from "./user.repository.ts";
import type { UpdateAiSettingsInput, UserResponseDto } from "./user.types.ts";

export const userService = {
  async getOrCreateByClerkId(clerkId: string): Promise<User> {
    const existing = await userRepository.findByClerkId(clerkId);
    if (existing) return existing;

    const clerkUser = await clerkClient.users.getUser(clerkId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new UnauthorizedError("Clerk account has no email address");
    }

    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username || "Unnamed User";

    return userRepository.create({
      clerkId,
      name,
      email,
      profileImage: clerkUser.imageUrl,
    });
  },

  updateName(userId: string, name: string): Promise<User> {
    return userRepository.updateName(userId, name);
  },

  updateAiSettings(userId: string, input: UpdateAiSettingsInput): Promise<User> {
    const data: { aiProvider?: "GEMINI" | "GROQ"; encryptedGeminiKey?: string | null; encryptedGroqKey?: string | null } = {};
    if (input.provider !== undefined) {
      data.aiProvider = input.provider;
    }
    if (input.geminiApiKey !== undefined) {
      data.encryptedGeminiKey = input.geminiApiKey === null ? null : encryptSecret(input.geminiApiKey);
    }
    if (input.groqApiKey !== undefined) {
      data.encryptedGroqKey = input.groqApiKey === null ? null : encryptSecret(input.groqApiKey);
    }
    return userRepository.updateAiSettings(userId, data);
  },

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      aiProvider: user.aiProvider,
      hasGeminiKey: Boolean(user.encryptedGeminiKey),
      hasGroqKey: Boolean(user.encryptedGroqKey),
    };
  },

  /** Same as toResponse, plus the org an API-key credential is scoped to - a
   * non-interactive client (the MCP server) has no other way to learn its own
   * orgSlug, since the bearer token itself is opaque. */
  async toResponseWithApiKeyOrganization(user: User, apiKeyOrganizationId?: string): Promise<UserResponseDto> {
    const base = userService.toResponse(user);
    if (!apiKeyOrganizationId) {
      return base;
    }

    const organization = await organizationRepository.findById(apiKeyOrganizationId);
    if (!organization) {
      return base;
    }

    const membership = await memberRepository.findByUserAndOrg(user.id, organization.id);
    return {
      ...base,
      apiKeyOrganization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        role: membership?.role ?? "VIEWER",
      },
    };
  },
};
