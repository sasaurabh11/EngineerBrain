import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { resolveAiProviderConfig } from "../../infra/aiService/providerConfig.ts";
import { listDeploymentsQuerySchema, listIncidentsQuerySchema } from "./production.validation.ts";
import { productionService } from "./production.service.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

function pageInfo(page: number, pageSize: number, totalCount: number) {
  return { page, pageSize, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) };
}

export const productionController = {
  async declareIncident(req: Request, res: Response) {
    const incident = await productionService.declareIncident(
      req.organization!.id,
      req.dbUser!.id,
      req.body.title,
      req.body.severity,
      req.body.serviceId,
    );
    sendSuccess(res, incident, 201);
  },

  async createIntegration(req: Request, res: Response) {
    const integration = await productionService.createIntegration(
      req.organization!.id,
      req.dbUser!.id,
      req.body.provider,
      req.body.name,
      req.body.config,
      req.body.credential,
    );
    sendSuccess(res, integration, 201);
  },

  async listIntegrations(req: Request, res: Response) {
    const integrations = await productionService.listIntegrations(req.organization!.id);
    sendSuccess(res, integrations);
  },

  async removeIntegration(req: Request, res: Response) {
    await productionService.removeIntegration(req.organization!.id, getParam(req, "integrationId"));
    sendSuccess(res, { deleted: true });
  },

  async createService(req: Request, res: Response) {
    const service = await productionService.createService(
      req.organization!.id,
      req.body.name,
      req.body.repositoryId,
      req.body.integrationId,
      req.body.ownerUserId,
      req.body.criticality,
    );
    sendSuccess(res, service, 201);
  },

  async listServices(req: Request, res: Response) {
    const services = await productionService.listServices(req.organization!.id);
    sendSuccess(res, services);
  },

  async serviceHealth(req: Request, res: Response) {
    const health = await productionService.getServiceHealth(req.organization!.id, getParam(req, "serviceId"));
    sendSuccess(res, health);
  },

  async listDeployments(req: Request, res: Response) {
    const query = listDeploymentsQuerySchema.query.parse(req.query);
    const { items, totalCount } = await productionService.listDeployments(req.organization!.id, query);
    sendSuccess(res, { items, pageInfo: pageInfo(query.page, query.pageSize, totalCount) });
  },

  async listIncidents(req: Request, res: Response) {
    const query = listIncidentsQuerySchema.query.parse(req.query);
    const { items, totalCount } = await productionService.listIncidents(req.organization!.id, query);
    sendSuccess(res, { items, pageInfo: pageInfo(query.page, query.pageSize, totalCount) });
  },

  async getIncident(req: Request, res: Response) {
    const incident = await productionService.getIncident(req.organization!.id, getParam(req, "incidentId"));
    sendSuccess(res, incident);
  },

  async getTimeline(req: Request, res: Response) {
    const timeline = await productionService.getTimeline(req.organization!.id, getParam(req, "incidentId"));
    sendSuccess(res, timeline);
  },

  async getSignals(req: Request, res: Response) {
    const signals = await productionService.getSignals(req.organization!.id, getParam(req, "incidentId"));
    sendSuccess(res, signals);
  },

  async getRootCause(req: Request, res: Response) {
    const rootCause = await productionService.getRootCause(req.organization!.id, getParam(req, "incidentId"));
    sendSuccess(res, rootCause);
  },

  async getRecommendations(req: Request, res: Response) {
    const recommendations = await productionService.getRecommendations(req.organization!.id, getParam(req, "incidentId"));
    sendSuccess(res, recommendations);
  },

  async generatePostmortem(req: Request, res: Response) {
    const postmortem = await productionService.generatePostmortem(
      req.organization!.id,
      getParam(req, "incidentId"),
      resolveAiProviderConfig(req.dbUser!),
    );
    sendSuccess(res, postmortem, 201);
  },

  async getPostmortem(req: Request, res: Response) {
    const postmortem = await productionService.getPostmortem(req.organization!.id, getParam(req, "incidentId"));
    sendSuccess(res, postmortem);
  },
};
