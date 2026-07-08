import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { invitationController } from "./invitation.controller.ts";
import { createInvitationSchema } from "./invitation.validation.ts";

export const invitationRouter = Router();

invitationRouter.get(
  "/organizations/:orgSlug/invitations",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  invitationController.list,
);

invitationRouter.post(
  "/organizations/:orgSlug/invitations",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  validate(createInvitationSchema),
  invitationController.create,
);

invitationRouter.delete(
  "/organizations/:orgSlug/invitations/:invitationId",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  invitationController.revoke,
);

invitationRouter.post("/invitations/:token/accept", requireAuthenticatedUser, invitationController.accept);
