import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { analysisController } from "./analysis.controller.ts";
import { listFindingsQuerySchema } from "./analysis.validation.ts";

export const analysisRouter = Router();

const base = "/organizations/:orgSlug/repositories/:repositoryId/analysis";

analysisRouter.post(base, requireAuthenticatedUser, requireOrgRole(["OWNER", "ADMIN"]), analysisController.trigger);

analysisRouter.get(`${base}/status`, requireAuthenticatedUser, requireOrgRole(), analysisController.status);

analysisRouter.get(base, requireAuthenticatedUser, requireOrgRole(), analysisController.latest);

analysisRouter.get(
  `${base}/findings`,
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(listFindingsQuerySchema),
  analysisController.findings,
);

analysisRouter.get(`${base}/history`, requireAuthenticatedUser, requireOrgRole(), analysisController.history);
