import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { memberController } from "./member.controller.ts";
import { updateMemberRoleSchema } from "./member.validation.ts";

export const memberRouter = Router();

memberRouter.get(
  "/organizations/:orgSlug/members",
  requireAuthenticatedUser,
  requireOrgRole(),
  memberController.list,
);

memberRouter.patch(
  "/organizations/:orgSlug/members/:memberId",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  validate(updateMemberRoleSchema),
  memberController.updateRole,
);

memberRouter.delete(
  "/organizations/:orgSlug/members/:memberId",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  memberController.remove,
);
