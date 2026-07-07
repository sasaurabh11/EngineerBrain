import type { Organization, OrgRole } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";
import { generateUniqueSlug } from "../../utils/slug.ts";
import { organizationRepository } from "./organization.repository.ts";
import type { CreateOrganizationInput, OrganizationResponseDto, UpdateOrganizationInput } from "./organization.types.ts";

export const organizationService = {
  async listForUser(userId: string): Promise<OrganizationResponseDto[]> {
    const memberships = await organizationRepository.listForUser(userId);
    return memberships.map((membership) => organizationService.toResponse(membership.organization, membership.role));
  },

  async create(userId: string, input: CreateOrganizationInput): Promise<OrganizationResponseDto> {
    const slug = await generateUniqueSlug(input.name);

    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          logoUrl: input.logoUrl ?? null,
          ownerId: userId,
        },
      });

      await tx.organizationMember.create({
        data: { organizationId: org.id, userId, role: "OWNER" },
      });

      return org;
    });

    return organizationService.toResponse(organization, "OWNER");
  },

  update(organizationId: string, input: UpdateOrganizationInput): Promise<Organization> {
    return organizationRepository.updateById(organizationId, input);
  },

  async softDelete(organizationId: string): Promise<void> {
    await organizationRepository.softDeleteById(organizationId);
  },

  toResponse(organization: Organization, role: OrgRole): OrganizationResponseDto {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      logoUrl: organization.logoUrl,
      ownerId: organization.ownerId,
      role,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  },
};
