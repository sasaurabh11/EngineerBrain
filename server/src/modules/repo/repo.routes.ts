import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { repoController } from "./repo.controller.ts";
import { importRepositoriesSchema, listRepositoriesQuerySchema } from "./repo.validation.ts";

export const repoRouter = Router();

const base = "/organizations/:orgSlug/repositories";

repoRouter.get(
  "/organizations/:orgSlug/github/available-repositories",
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  repoController.listAvailable,
);

repoRouter.get(base, requireAuthenticatedUser, requireOrgRole(), validate(listRepositoriesQuerySchema), repoController.list);

repoRouter.post(
  `${base}/import`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  validate(importRepositoriesSchema),
  repoController.import,
);

repoRouter.get(`${base}/:repositoryId`, requireAuthenticatedUser, requireOrgRole(), repoController.get);

repoRouter.delete(
  `${base}/:repositoryId`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  repoController.remove,
);

repoRouter.post(
  `${base}/:repositoryId/sync`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  repoController.sync,
);

repoRouter.get(`${base}/:repositoryId/branches`, requireAuthenticatedUser, requireOrgRole(), repoController.branches);
repoRouter.get(`${base}/:repositoryId/commits`, requireAuthenticatedUser, requireOrgRole(), repoController.commits);
repoRouter.get(
  `${base}/:repositoryId/contributors`,
  requireAuthenticatedUser,
  requireOrgRole(),
  repoController.contributors,
);
repoRouter.get(
  `${base}/:repositoryId/pull-requests`,
  requireAuthenticatedUser,
  requireOrgRole(),
  repoController.pullRequests,
);
repoRouter.get(`${base}/:repositoryId/issues`, requireAuthenticatedUser, requireOrgRole(), repoController.issues);
