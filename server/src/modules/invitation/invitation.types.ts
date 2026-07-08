import type { InvitationStatus, OrgRole } from "@prisma/client";

export interface InvitationResponseDto {
  id: string;
  email: string;
  role: OrgRole;
  status: InvitationStatus;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateInvitationInput {
  email: string;
  role: OrgRole;
}
