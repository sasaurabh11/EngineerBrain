import type { Organization, OrganizationMember, User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      dbUser?: User;
      organization?: Organization;
      membership?: OrganizationMember;
      rawBody?: Buffer;
      /** Set by requireAuthenticatedUser when the request was authenticated via
       * an org-scoped API key rather than a Clerk session - requireOrgRole uses
       * this to reject the key if the URL's :orgSlug resolves to a different org. */
      apiKeyOrganizationId?: string;
    }
  }
}

export {};
