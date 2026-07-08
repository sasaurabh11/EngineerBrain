import { prisma } from "../../database/prisma.ts";

export const webhookRepository = {
  findById(id: string) {
    return prisma.webhookEvent.findUnique({ where: { id } });
  },

  create(data: {
    installationId: string | null;
    githubDeliveryId: string;
    eventType: string;
    action: string | null;
    payload: unknown;
  }) {
    return prisma.webhookEvent.create({
      data: { ...data, payload: data.payload as object },
    });
  },

  markProcessed(id: string) {
    return prisma.webhookEvent.update({
      where: { id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  },

  markFailed(id: string, errorMessage: string) {
    return prisma.webhookEvent.update({
      where: { id },
      data: { status: "FAILED", processedAt: new Date(), errorMessage },
    });
  },
};
