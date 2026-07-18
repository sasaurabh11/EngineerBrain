import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { productionController } from "./production.controller.ts";
import {
  createIncidentSchema,
  createIntegrationSchema,
  createServiceSchema,
  listDeploymentsQuerySchema,
  listIncidentsQuerySchema,
} from "./production.validation.ts";

export const productionRouter = Router();

const base = "/organizations/:orgSlug/production";

productionRouter.post(
  `${base}/integrations`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  validate(createIntegrationSchema),
  productionController.createIntegration,
);
productionRouter.get(`${base}/integrations`, requireAuthenticatedUser, requireOrgRole(), productionController.listIntegrations);
productionRouter.delete(
  `${base}/integrations/:integrationId`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  productionController.removeIntegration,
);

productionRouter.post(
  `${base}/services`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  validate(createServiceSchema),
  productionController.createService,
);
productionRouter.get(`${base}/services`, requireAuthenticatedUser, requireOrgRole(), productionController.listServices);
productionRouter.get(`${base}/services/:serviceId/health`, requireAuthenticatedUser, requireOrgRole(), productionController.serviceHealth);

productionRouter.get(`${base}/deployments`, requireAuthenticatedUser, requireOrgRole(), validate(listDeploymentsQuerySchema), productionController.listDeployments);

productionRouter.post(
  `${base}/incidents`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  validate(createIncidentSchema),
  productionController.declareIncident,
);
productionRouter.get(`${base}/incidents`, requireAuthenticatedUser, requireOrgRole(), validate(listIncidentsQuerySchema), productionController.listIncidents);
productionRouter.get(`${base}/incidents/:incidentId`, requireAuthenticatedUser, requireOrgRole(), productionController.getIncident);
productionRouter.get(`${base}/incidents/:incidentId/timeline`, requireAuthenticatedUser, requireOrgRole(), productionController.getTimeline);
productionRouter.get(`${base}/incidents/:incidentId/signals`, requireAuthenticatedUser, requireOrgRole(), productionController.getSignals);
productionRouter.get(`${base}/incidents/:incidentId/root-cause`, requireAuthenticatedUser, requireOrgRole(), productionController.getRootCause);
productionRouter.get(
  `${base}/incidents/:incidentId/recommendations`,
  requireAuthenticatedUser,
  requireOrgRole(),
  productionController.getRecommendations,
);

productionRouter.post(
  `${base}/incidents/:incidentId/postmortem`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  productionController.generatePostmortem,
);
productionRouter.get(`${base}/incidents/:incidentId/postmortem`, requireAuthenticatedUser, requireOrgRole(), productionController.getPostmortem);
