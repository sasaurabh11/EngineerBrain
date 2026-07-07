import { clerkClient } from "@clerk/express";
import type { User } from "@prisma/client";
import { UnauthorizedError } from "../../common/errors/AppError.ts";
import { userRepository } from "./user.repository.ts";
import type { UserResponseDto } from "./user.types.ts";

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

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },
};
