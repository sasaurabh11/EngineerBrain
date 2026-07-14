import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { indexingController } from "./indexing.controller.ts";
import { symbolSourceQuerySchema } from "./indexing.validation.ts";

export const indexingRouter = Router();

const base = "/organizations/:orgSlug/repositories/:repositoryId";

indexingRouter.post(
  `${base}/index`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  indexingController.trigger,
);

indexingRouter.post(
  `${base}/reindex`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  indexingController.reindex,
);

indexingRouter.get(`${base}/index/status`, requireAuthenticatedUser, requireOrgRole(), indexingController.status);
indexingRouter.get(`${base}/files`, requireAuthenticatedUser, requireOrgRole(), indexingController.files);
indexingRouter.get(`${base}/classes`, requireAuthenticatedUser, requireOrgRole(), indexingController.classes);
indexingRouter.get(`${base}/functions`, requireAuthenticatedUser, requireOrgRole(), indexingController.functions);
indexingRouter.get(`${base}/graph`, requireAuthenticatedUser, requireOrgRole(), indexingController.graph);
indexingRouter.get(`${base}/endpoints`, requireAuthenticatedUser, requireOrgRole(), indexingController.endpoints);

indexingRouter.get(
  `${base}/symbols/source`,
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(symbolSourceQuerySchema),
  indexingController.symbolSource,
);
