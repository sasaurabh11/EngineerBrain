import type { OrgRole } from "./organization.types";

export interface Member {
  id: string;
  role: OrgRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    profileImage: string | null;
  };
}
