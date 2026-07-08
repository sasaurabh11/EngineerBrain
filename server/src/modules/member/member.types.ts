import type { OrgRole } from "@prisma/client";

export interface MemberResponseDto {
  id: string;
  role: OrgRole;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    profileImage: string | null;
  };
}
