import { prisma } from "../../database/prisma.ts";

export const apiKeyRepository = {
  listActiveByOrg(organizationId: string) {
    return prisma.apiKey.findMany({
      where: { organizationId, revokedAt: null },
      include: { createdBy: true },
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.apiKey.findUnique({ where: { id } });
  },

  findActiveByHashedKey(hashedKey: string) {
    return prisma.apiKey.findFirst({ where: { hashedKey, revokedAt: null }, include: { createdBy: true } });
  },

  create(data: { organizationId: string; createdById: string; name: string; keyPrefix: string; hashedKey: string }) {
    return prisma.apiKey.create({ data, include: { createdBy: true } });
  },

  revoke(id: string): Promise<void> {
    return prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }).then(() => undefined);
  },

  touchLastUsed(id: string): Promise<void> {
    return prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } }).then(() => undefined);
  },
};
