import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { organizationController } from "./organization.controller.ts";
import { createOrganizationSchema, updateOrganizationSchema } from "./organization.validation.ts";

export const organizationRouter = Router();

organizationRouter.get("/organizations", requireAuthenticatedUser, organizationController.list);

organizationRouter.post(
  "/organizations",
  requireAuthenticatedUser,
  validate(createOrganizationSchema),
  organizationController.create,
);

organizationRouter.get(
  "/organizations/:orgSlug",
  requireAuthenticatedUser,
  requireOrgRole(),
  organizationController.get,
);

organizationRouter.patch(
  "/organizations/:orgSlug",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  validate(updateOrganizationSchema),
  organizationController.update,
);

organizationRouter.delete(
  "/organizations/:orgSlug",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER"]),
  organizationController.remove,
);
