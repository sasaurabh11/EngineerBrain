import type { OrgRole } from "@prisma/client";

export interface OrganizationResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  role: OrgRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationInput {
  name: string;
  description?: string;
  logoUrl?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
}
