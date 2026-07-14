import type { OrgRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, NotFoundError } from "../common/errors/AppError.ts";
import { memberRepository } from "../modules/member/member.repository.ts";
import { organizationRepository } from "../modules/organization/organization.repository.ts";

export function requireOrgRole(allowedRoles?: OrgRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const orgSlug = typeof req.params.orgSlug === "string" ? req.params.orgSlug : "";
      const organization = await organizationRepository.findBySlug(orgSlug);
      if (!organization) {
        throw new NotFoundError("Organization not found");
      }

      if (req.apiKeyOrganizationId && req.apiKeyOrganizationId !== organization.id) {
        throw new ForbiddenError("This API key is not authorized for this organization");
      }

      const membership = await memberRepository.findByUserAndOrg(req.dbUser!.id, organization.id);
      if (!membership) {
        throw new ForbiddenError("You are not a member of this organization");
      }

      if (allowedRoles && !allowedRoles.includes(membership.role)) {
        throw new ForbiddenError("Insufficient permissions for this action");
      }

      req.organization = organization;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
