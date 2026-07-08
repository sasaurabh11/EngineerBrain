import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { githubController } from "./github.controller.ts";
import { githubCallbackSchema } from "./github.validation.ts";

export const githubRouter = Router();

githubRouter.get(
  "/organizations/:orgSlug/github/status",
  requireAuthenticatedUser,
  requireOrgRole(),
  githubController.status,
);

githubRouter.get(
  "/organizations/:orgSlug/github/install-url",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  githubController.installUrl,
);

githubRouter.post(
  "/organizations/:orgSlug/github/disconnect",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  githubController.disconnect,
);

// Public: GitHub redirects the user's browser here after installation. No org
// in the URL (GitHub doesn't know it) - org context comes from the signed state.
githubRouter.get("/github/callback", validate(githubCallbackSchema), githubController.callback);
