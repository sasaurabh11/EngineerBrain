import type { OrgRole } from "./organization.types";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED" | "DECLINED";

export interface Invitation {
  id: string;
  email: string;
  role: OrgRole;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
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
