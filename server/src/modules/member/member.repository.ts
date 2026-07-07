import type { OrganizationMember } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export const memberRepository = {
  findByUserAndOrg(userId: string, organizationId: string): Promise<OrganizationMember | null> {
    return prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
  },
};
