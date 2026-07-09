import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { searchController } from "./search.controller.ts";
import { searchQuerySchema } from "./search.validation.ts";

export const searchRouter = Router();

searchRouter.get(
  "/organizations/:orgSlug/repositories/:repositoryId/search",
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(searchQuerySchema),
  searchController.searchRepository,
);

searchRouter.get(
  "/organizations/:orgSlug/search",
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(searchQuerySchema),
  searchController.searchOrganization,
);
