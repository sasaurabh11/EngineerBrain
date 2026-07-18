import type { User } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export interface UpdateAiSettingsData {
  aiProvider?: "GEMINI" | "GROQ";
  encryptedGeminiKey?: string | null;
  encryptedGroqKey?: string | null;
}

export const userRepository = {
  findByClerkId(clerkId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { clerkId } });
  },

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: { clerkId: string; name: string; email: string; profileImage: string | null }): Promise<User> {
    return prisma.user.create({ data });
  },

  updateName(id: string, name: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { name } });
  },

  updateAiSettings(id: string, data: UpdateAiSettingsData): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },
};
