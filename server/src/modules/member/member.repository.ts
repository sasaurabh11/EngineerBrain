import type { OrgRole } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export const memberRepository = {
  findByUserAndOrg(userId: string, organizationId: string) {
    return prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
  },

  findById(memberId: string) {
    return prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    });
  },

  listByOrg(organizationId: string) {
    return prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
  },

  countOwners(organizationId: string): Promise<number> {
    return prisma.organizationMember.count({ where: { organizationId, role: "OWNER" } });
  },

  updateRole(memberId: string, role: OrgRole) {
    return prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: true },
    });
  },

  remove(memberId: string): Promise<void> {
    return prisma.organizationMember.delete({ where: { id: memberId } }).then(() => undefined);
  },
};
