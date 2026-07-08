import type { OrgRole } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export const invitationRepository = {
  listPendingByOrg(organizationId: string) {
    return prisma.invitation.findMany({
      where: { organizationId, status: "PENDING" },
      include: { invitedBy: true, organization: true },
      orderBy: { createdAt: "desc" },
    });
  },

  listPendingForEmail(email: string) {
    return prisma.invitation.findMany({
      where: { email: email.toLowerCase(), status: "PENDING" },
      include: { invitedBy: true, organization: true },
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.invitation.findUnique({ where: { id } });
  },

  findByToken(token: string) {
    return prisma.invitation.findUnique({ where: { token } });
  },

  create(data: {
    email: string;
    organizationId: string;
    role: OrgRole;
    invitedById: string;
    token: string;
    expiresAt: Date;
  }) {
    return prisma.invitation.create({
      data,
      include: { invitedBy: true, organization: true },
    });
  },

  delete(id: string): Promise<void> {
    return prisma.invitation.delete({ where: { id } }).then(() => undefined);
  },
};
