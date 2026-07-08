import type { SyncTrigger } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export const syncRepository = {
  create(repositoryId: string, trigger: SyncTrigger, triggeredById: string | null) {
    return prisma.repositorySync.create({
      data: { repositoryId, trigger, triggeredById, status: "PENDING" },
    });
  },

  markRunning(id: string) {
    return prisma.repositorySync.update({ where: { id }, data: { status: "RUNNING" } });
  },

  markSuccess(id: string) {
    return prisma.repositorySync.update({
      where: { id },
      data: { status: "SUCCESS", completedAt: new Date() },
    });
  },

  markFailed(id: string, errorMessage: string) {
    return prisma.repositorySync.update({
      where: { id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage },
    });
  },
};
