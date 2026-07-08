export type OrgRole = "OWNER" | "ADMIN" | "MANAGER" | "DEVELOPER" | "QA" | "VIEWER";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  role: OrgRole;
  createdAt: string;
  updatedAt: string;
}
