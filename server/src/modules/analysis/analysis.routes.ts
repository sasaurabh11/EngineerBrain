import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { analysisController } from "./analysis.controller.ts";
import { listFindingsQuerySchema, listHistoryQuerySchema, trendQuerySchema } from "./analysis.validation.ts";

export const analysisRouter = Router();

const base = "/organizations/:orgSlug/repositories/:repositoryId/analysis";

analysisRouter.post(base, requireAuthenticatedUser, requireOrgRole(["OWNER", "ADMIN"]), analysisController.trigger);

analysisRouter.post(
  `${base}/:analysisId/retry`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  analysisController.retry,
);

analysisRouter.post(
  `${base}/:analysisId/cancel`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  analysisController.cancel,
);

analysisRouter.get(`${base}/status`, requireAuthenticatedUser, requireOrgRole(), analysisController.status);

analysisRouter.get(base, requireAuthenticatedUser, requireOrgRole(), analysisController.latest);

analysisRouter.get(
  `${base}/findings`,
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(listFindingsQuerySchema),
  analysisController.findings,
);

analysisRouter.get(
  `${base}/history`,
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(listHistoryQuerySchema),
  analysisController.history,
);

analysisRouter.get(
  `${base}/trend`,
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(trendQuerySchema),
  analysisController.trend,
);

analysisRouter.get(
  `${base}/report/json`,
  requireAuthenticatedUser,
  requireOrgRole(),
  analysisController.reportJson,
);

analysisRouter.get(
  `${base}/report/markdown`,
  requireAuthenticatedUser,
  requireOrgRole(),
  analysisController.reportMarkdown,
);
