import type { Organization } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export const organizationRepository = {
  findBySlug(slug: string): Promise<Organization | null> {
    return prisma.organization.findFirst({ where: { slug, deletedAt: null } });
  },

  listForUser(userId: string) {
    return prisma.organizationMember.findMany({
      where: { userId, organization: { deletedAt: null } },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  },

  updateById(id: string, data: { name?: string; description?: string | null; logoUrl?: string | null }): Promise<Organization> {
    return prisma.organization.update({ where: { id }, data });
  },

  softDeleteById(id: string): Promise<Organization> {
    return prisma.organization.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
