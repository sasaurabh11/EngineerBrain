import type { InvitationStatus, OrgRole } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export const invitationRepository = {
  listPendingByOrg(organizationId: string) {
    return prisma.invitation.findMany({
      where: { organizationId, status: "PENDING" },
      include: { invitedBy: true },
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
      include: { invitedBy: true },
    });
  },

  updateStatus(id: string, status: InvitationStatus) {
    return prisma.invitation.update({ where: { id }, data: { status } });
  },

  delete(id: string): Promise<void> {
    return prisma.invitation.delete({ where: { id } }).then(() => undefined);
  },
};
