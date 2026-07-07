import type { Organization, OrganizationMember, User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      dbUser?: User;
      organization?: Organization;
      membership?: OrganizationMember;
    }
  }
}

export {};
