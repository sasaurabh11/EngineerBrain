import type { IncidentSeverity, ProductionProvider } from "@prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../../common/errors/AppError.ts";
import { callAgentStepWithRetry } from "../ai/agents/agentClient.ts";
import { encryptSecret } from "../../infra/crypto/secretBox.ts";
import { taskService } from "../tasks/task.service.ts";
import { productionRepository } from "./production.repository.ts";
import type {
  DeploymentResponseDto,
  IncidentResponseDto,
  IncidentSignalResponseDto,
  IncidentTimelineEventResponseDto,
  IntegrationResponseDto,
  ListDeploymentsFilters,
  ListIncidentsFilters,
  PostmortemResponseDto,
  RecommendationResponseDto,
  RootCauseAnalysisResponseDto,
  ServiceHealthResponseDto,
  ServiceResponseDto,
} from "./production.types.ts";

export const productionService = {
  // --- Integrations ---
  async createIntegration(
    organizationId: string,
    createdById: string,
    provider: ProductionProvider,
    name: string,
    config: Record<string, unknown>,
    credential?: string,
  ): Promise<IntegrationResponseDto> {
    const encryptedCredential = credential ? encryptSecret(credential) : null;
    const integration = await productionRepository.createIntegration(organizationId, createdById, provider, name, config, encryptedCredential);
    return productionService.toIntegrationDto(integration);
  },

  async listIntegrations(organizationId: string): Promise<IntegrationResponseDto[]> {
    const integrations = await productionRepository.listIntegrations(organizationId);
    return integrations.map(productionService.toIntegrationDto);
  },

  async removeIntegration(organizationId: string, id: string): Promise<void> {
    const integration = await productionRepository.findIntegrationByOrgAndId(organizationId, id);
    if (!integration) throw new NotFoundError("Production integration not found");
    await productionRepository.removeIntegration(id);
  },

  toIntegrationDto(integration: {
    id: string;
    provider: ProductionProvider;
    name: string;
    config: unknown;
    encryptedCredential: string | null;
    status: IntegrationResponseDto["status"];
    createdAt: Date;
  }): IntegrationResponseDto {
    return {
      id: integration.id,
      provider: integration.provider,
      name: integration.name,
      config: (integration.config as Record<string, unknown>) ?? {},
      hasCredential: Boolean(integration.encryptedCredential),
      status: integration.status,
      createdAt: integration.createdAt,
    };
  },

  // --- Services ---
  async createService(
    organizationId: string,
    name: string,
    repositoryId?: string,
    integrationId?: string,
    ownerUserId?: string,
    criticality?: ServiceResponseDto["criticality"],
  ): Promise<ServiceResponseDto> {
    const service = await productionRepository.createService(
      organizationId,
      name,
      repositoryId ?? null,
      integrationId ?? null,
      ownerUserId ?? null,
      criticality ?? "MEDIUM",
    );
    return productionService.toServiceDto(service);
  },

  async listServices(organizationId: string): Promise<ServiceResponseDto[]> {
    const services = await productionRepository.listServices(organizationId);
    return services.map(productionService.toServiceDto);
  },

  async getServiceHealth(organizationId: string, serviceId: string): Promise<ServiceHealthResponseDto> {
    const service = await productionRepository.findServiceByOrgAndId(organizationId, serviceId);
    if (!service) throw new NotFoundError("Service not found");

    const snapshot = await productionRepository.latestHealthSnapshot(serviceId);
    return {
      serviceId,
      capturedAt: snapshot?.capturedAt ?? new Date(),
      errorRate: snapshot?.errorRate ?? null,
      p95LatencyMs: snapshot?.p95LatencyMs ?? null,
      riskScore: snapshot?.riskScore ?? null,
    };
  },

  toServiceDto(service: {
    id: string;
    name: string;
    repositoryId: string | null;
    ownerUserId: string | null;
    criticality: ServiceResponseDto["criticality"];
    createdAt: Date;
  }): ServiceResponseDto {
    return {
      id: service.id,
      name: service.name,
      repositoryId: service.repositoryId,
      ownerUserId: service.ownerUserId,
      criticality: service.criticality,
      createdAt: service.createdAt,
    };
  },

  // --- Deployments ---
  async listDeployments(organizationId: string, filters: ListDeploymentsFilters): Promise<{ items: DeploymentResponseDto[]; totalCount: number }> {
    const { items, totalCount } = await productionRepository.listDeployments(organizationId, filters);
    return { items: items.map(productionService.toDeploymentDto), totalCount };
  },

  toDeploymentDto(deployment: {
    id: string;
    serviceId: string;
    repositoryId: string | null;
    pullRequestId: string | null;
    commitSha: string | null;
    version: string | null;
    environment: string;
    status: DeploymentResponseDto["status"];
    deployedAt: Date;
    sourceProvider: ProductionProvider;
  }): DeploymentResponseDto {
    return {
      id: deployment.id,
      serviceId: deployment.serviceId,
      repositoryId: deployment.repositoryId,
      pullRequestId: deployment.pullRequestId,
      commitSha: deployment.commitSha,
      version: deployment.version,
      environment: deployment.environment,
      status: deployment.status,
      deployedAt: deployment.deployedAt,
      sourceProvider: deployment.sourceProvider,
    };
  },

  // --- Incidents ---
  /** Manually declares an incident (as opposed to one auto-detected from an
   * Alertmanager alert) and immediately kicks off the same real
   * incident-analysis Task pipeline - the actor is the user who declared it,
   * not a heuristic fallback, since we have a real logged-in user here. */
  async declareIncident(organizationId: string, createdById: string, title: string, severity: IncidentSeverity, serviceId?: string): Promise<IncidentResponseDto> {
    if (serviceId) {
      const service = await productionRepository.findServiceByOrgAndId(organizationId, serviceId);
      if (!service) throw new NotFoundError("Service not found");
    }

    const incident = await productionRepository.createIncident({ organizationId, serviceId: serviceId ?? null, title, severity });

    try {
      const task = await taskService.enqueueTask(organizationId, createdById, `Investigate incident: ${title}`, undefined, "incident-analysis", {
        incidentId: incident.id,
      });
      await productionRepository.attachTask(incident.id, task.id);
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      // Organization already has a task in progress - incident is still
      // created, analysis can be triggered manually once that one finishes.
    }

    return productionService.getIncident(organizationId, incident.id);
  },

  async listIncidents(organizationId: string, filters: ListIncidentsFilters): Promise<{ items: IncidentResponseDto[]; totalCount: number }> {
    const { items, totalCount } = await productionRepository.listIncidents(organizationId, filters);
    return { items: items.map(productionService.toIncidentDto), totalCount };
  },

  async getIncident(organizationId: string, incidentId: string): Promise<IncidentResponseDto> {
    const incident = await productionRepository.findIncidentByOrgAndId(organizationId, incidentId);
    if (!incident) throw new NotFoundError("Incident not found");
    return productionService.toIncidentDto(incident);
  },

  async getTimeline(organizationId: string, incidentId: string): Promise<IncidentTimelineEventResponseDto[]> {
    await productionService.assertIncidentInOrg(organizationId, incidentId);
    const events = await productionRepository.listTimeline(incidentId);
    return events;
  },

  async getSignals(organizationId: string, incidentId: string): Promise<IncidentSignalResponseDto[]> {
    await productionService.assertIncidentInOrg(organizationId, incidentId);
    return productionRepository.listSignals(incidentId);
  },

  async getRootCause(organizationId: string, incidentId: string): Promise<RootCauseAnalysisResponseDto> {
    await productionService.assertIncidentInOrg(organizationId, incidentId);
    const rootCause = await productionRepository.findRootCause(incidentId);
    if (!rootCause) throw new NotFoundError("Root cause analysis has not been generated for this incident yet");
    return rootCause;
  },

  async getRecommendations(organizationId: string, incidentId: string): Promise<RecommendationResponseDto[]> {
    await productionService.assertIncidentInOrg(organizationId, incidentId);
    return productionRepository.listRecommendations(incidentId);
  },

  async assertIncidentInOrg(organizationId: string, incidentId: string): Promise<void> {
    const incident = await productionRepository.findIncidentByOrgAndId(organizationId, incidentId);
    if (!incident) throw new NotFoundError("Incident not found");
  },

  toIncidentDto(incident: {
    id: string;
    title: string;
    status: IncidentResponseDto["status"];
    severity: IncidentResponseDto["severity"];
    serviceId: string | null;
    deploymentId: string | null;
    taskId: string | null;
    confidenceScore: number | null;
    detectedAt: Date;
    resolvedAt: Date | null;
  }): IncidentResponseDto {
    return {
      id: incident.id,
      title: incident.title,
      status: incident.status,
      severity: incident.severity,
      serviceId: incident.serviceId,
      deploymentId: incident.deploymentId,
      taskId: incident.taskId,
      confidenceScore: incident.confidenceScore,
      detectedAt: incident.detectedAt,
      resolvedAt: incident.resolvedAt,
    };
  },

  // --- Postmortem ---
  async getPostmortem(organizationId: string, incidentId: string): Promise<PostmortemResponseDto> {
    await productionService.assertIncidentInOrg(organizationId, incidentId);
    const postmortem = await productionRepository.findPostmortemByIncident(incidentId);
    if (!postmortem) throw new BadRequestError("No postmortem has been generated for this incident yet");
    return postmortem;
  },

  /** Drafts a postmortem from already-collected evidence (root cause,
   * signals, timeline, recommendations) - a single bounded synthesis call,
   * not a multi-step Task, since by this point every input is already on
   * hand. Requires root-cause analysis to have already run. */
  async generatePostmortem(organizationId: string, incidentId: string): Promise<PostmortemResponseDto> {
    const incident = await productionRepository.findIncidentByOrgAndId(organizationId, incidentId);
    if (!incident) throw new NotFoundError("Incident not found");

    const rootCause = await productionRepository.findRootCause(incidentId);
    if (!rootCause) {
      throw new ConflictError("Root cause analysis must complete before a postmortem can be generated");
    }

    const [signals, timeline, recommendations] = await Promise.all([
      productionRepository.listSignals(incidentId),
      productionRepository.listTimeline(incidentId),
      productionRepository.listRecommendations(incidentId),
    ]);

    const evidenceText =
      `Incident: ${incident.title} (severity ${incident.severity})\n` +
      `Root cause: ${rootCause.mostLikelyCause} (confidence ${rootCause.confidenceScore}%)\n` +
      `Rollback recommended: ${rootCause.rollbackRecommended}\n\n` +
      `Timeline:\n${timeline.map((t) => `- ${t.occurredAt.toISOString()}: ${t.description}`).join("\n") || "(none)"}\n\n` +
      `Evidence:\n${signals.map((s) => `- [${s.signalType}] ${s.summary}`).join("\n") || "(none)"}\n\n` +
      `Recommendations:\n${recommendations.map((r) => `- [${r.priority}] ${r.title}: ${r.description}`).join("\n") || "(none)"}`;

    const prompt =
      `Write a professional incident postmortem from the following gathered evidence. Respond with ONLY a JSON object (no markdown fences) with these ` +
      `exact keys: executiveSummary (string), timelineMarkdown (markdown string), rootCauseMarkdown (markdown string), contributingFactors (string), ` +
      `customerImpact (string), recoverySteps (string), lessonsLearned (string), actionItems (array of {description: string}). ` +
      `Base every claim strictly on the evidence below - do not invent details.\n\n${evidenceText}`;

    const result = await callAgentStepWithRetry("synthesizer", [{ role: "user", content: prompt }]);
    const parsed = parsePostmortemJson(result.message.content ?? "");

    const postmortem = await productionRepository.upsertPostmortem(incidentId, organizationId, {
      executiveSummary: parsed.executiveSummary,
      timelineMarkdown: parsed.timelineMarkdown,
      rootCauseMarkdown: parsed.rootCauseMarkdown,
      contributingFactors: parsed.contributingFactors,
      customerImpact: parsed.customerImpact,
      recoverySteps: parsed.recoverySteps,
      lessonsLearned: parsed.lessonsLearned,
      actionItems: parsed.actionItems,
    });

    return postmortem;
  },
};

interface ParsedPostmortem {
  executiveSummary: string;
  timelineMarkdown: string;
  rootCauseMarkdown: string;
  contributingFactors: string;
  customerImpact: string;
  recoverySteps: string;
  lessonsLearned: string;
  actionItems: { description: string }[];
}

function parsePostmortemJson(text: string): ParsedPostmortem {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new BadRequestError("The AI response for this postmortem was not in the expected format - please retry");
  }
  const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedPostmortem>;
  return {
    executiveSummary: parsed.executiveSummary ?? "",
    timelineMarkdown: parsed.timelineMarkdown ?? "",
    rootCauseMarkdown: parsed.rootCauseMarkdown ?? "",
    contributingFactors: parsed.contributingFactors ?? "",
    customerImpact: parsed.customerImpact ?? "",
    recoverySteps: parsed.recoverySteps ?? "",
    lessonsLearned: parsed.lessonsLearned ?? "",
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
  };
}
