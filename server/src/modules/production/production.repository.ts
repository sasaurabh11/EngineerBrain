import type { DeploymentStatus, IncidentSeverity, IncidentStatus, Prisma, ProductionProvider } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";
import type { ListDeploymentsFilters, ListIncidentsFilters } from "./production.types.ts";

export const productionRepository = {
  // --- Integrations ---
  createIntegration(
    organizationId: string,
    createdById: string,
    provider: ProductionProvider,
    name: string,
    config: Record<string, unknown>,
    encryptedCredential: string | null,
  ) {
    return prisma.productionIntegration.create({
      data: { organizationId, createdById, provider, name, config: config as Prisma.InputJsonValue, encryptedCredential },
    });
  },

  listIntegrations(organizationId: string) {
    return prisma.productionIntegration.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  },

  findIntegrationByOrgAndId(organizationId: string, id: string) {
    return prisma.productionIntegration.findFirst({ where: { id, organizationId } });
  },

  findIntegrationById(id: string) {
    return prisma.productionIntegration.findUnique({ where: { id } });
  },

  removeIntegration(id: string): Promise<void> {
    return prisma.productionIntegration.delete({ where: { id } }).then(() => undefined);
  },

  // --- Services ---
  createService(
    organizationId: string,
    name: string,
    repositoryId: string | null,
    integrationId: string | null,
    ownerUserId: string | null,
    criticality: Prisma.ServiceCreateInput["criticality"],
  ) {
    return prisma.service.create({
      data: { organizationId, name, repositoryId, integrationId, ownerUserId, criticality },
    });
  },

  listServices(organizationId: string) {
    return prisma.service.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  },

  findServiceByOrgAndId(organizationId: string, id: string) {
    return prisma.service.findFirst({ where: { id, organizationId } });
  },

  findServiceByRepository(organizationId: string, repositoryId: string) {
    return prisma.service.findFirst({ where: { organizationId, repositoryId } });
  },

  latestHealthSnapshot(serviceId: string) {
    return prisma.serviceHealthSnapshot.findFirst({ where: { serviceId }, orderBy: { capturedAt: "desc" } });
  },

  createHealthSnapshot(serviceId: string, errorRate: number | null, p95LatencyMs: number | null, riskScore: number | null) {
    return prisma.serviceHealthSnapshot.create({ data: { serviceId, errorRate, p95LatencyMs, riskScore } });
  },

  // --- Deployments ---
  createDeployment(data: {
    organizationId: string;
    serviceId: string;
    repositoryId: string | null;
    pullRequestId: string | null;
    commitSha: string | null;
    version: string | null;
    environment: string;
    status: DeploymentStatus;
    deployedAt: Date;
    sourceProvider: ProductionProvider;
    sourceRunId: string | null;
    rawPayload: Record<string, unknown> | null;
  }) {
    return prisma.deployment.upsert({
      where: {
        serviceId_sourceProvider_sourceRunId: {
          serviceId: data.serviceId,
          sourceProvider: data.sourceProvider,
          sourceRunId: data.sourceRunId ?? "",
        },
      },
      create: { ...data, rawPayload: (data.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined },
      update: { status: data.status },
    });
  },

  findMostRecentDeploymentForService(serviceId: string, before: Date) {
    return prisma.deployment.findFirst({
      where: { serviceId, deployedAt: { lte: before } },
      orderBy: { deployedAt: "desc" },
    });
  },

  listDeployments(organizationId: string, filters: ListDeploymentsFilters) {
    const where: Prisma.DeploymentWhereInput = {
      organizationId,
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.environment ? { environment: filters.environment } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    return Promise.all([
      prisma.deployment.findMany({ where, orderBy: { deployedAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
      prisma.deployment.count({ where }),
    ]).then(([items, totalCount]) => ({ items, totalCount }));
  },

  findDeploymentById(id: string) {
    return prisma.deployment.findUnique({ where: { id } });
  },

  // --- Production events (raw ingestion) ---
  findEventByDedupeKey(dedupeKey: string) {
    return prisma.productionEvent.findUnique({ where: { dedupeKey } });
  },

  createEvent(data: {
    organizationId: string;
    integrationId: string | null;
    eventType: "METRIC_ALERT" | "DEPLOYMENT";
    dedupeKey: string;
    rawPayload: Record<string, unknown>;
  }) {
    return prisma.productionEvent.create({ data: { ...data, rawPayload: data.rawPayload as Prisma.InputJsonValue } });
  },

  findEventById(id: string) {
    return prisma.productionEvent.findUnique({ where: { id } });
  },

  markEventProcessed(id: string) {
    return prisma.productionEvent.update({ where: { id }, data: { status: "PROCESSED", processedAt: new Date() } });
  },

  markEventFailed(id: string, errorMessage: string) {
    return prisma.productionEvent.update({ where: { id }, data: { status: "FAILED", processedAt: new Date(), errorMessage } });
  },

  // --- Incidents ---
  createIncident(data: { organizationId: string; serviceId: string | null; title: string; severity: IncidentSeverity }) {
    return prisma.incident.create({ data });
  },

  findOpenIncidentForService(organizationId: string, serviceId: string) {
    return prisma.incident.findFirst({
      where: { organizationId, serviceId, status: { in: ["DETECTED", "INVESTIGATING", "ROOT_CAUSED"] } },
      orderBy: { detectedAt: "desc" },
    });
  },

  attachTask(incidentId: string, taskId: string) {
    return prisma.incident.update({ where: { id: incidentId }, data: { status: "INVESTIGATING", taskId } });
  },

  attachDeployment(incidentId: string, deploymentId: string) {
    return prisma.incident.update({ where: { id: incidentId }, data: { deploymentId } });
  },

  setConfidence(incidentId: string, confidenceScore: number) {
    return prisma.incident.update({ where: { id: incidentId }, data: { confidenceScore, status: "ROOT_CAUSED" } });
  },

  findIncidentById(id: string) {
    return prisma.incident.findUnique({ where: { id } });
  },

  findIncidentByOrgAndId(organizationId: string, id: string) {
    return prisma.incident.findFirst({ where: { id, organizationId } });
  },

  findIncidentByTaskId(taskId: string) {
    return prisma.incident.findUnique({ where: { taskId } });
  },

  listIncidents(organizationId: string, filters: ListIncidentsFilters) {
    const where: Prisma.IncidentWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
    };
    return Promise.all([
      prisma.incident.findMany({ where, orderBy: { detectedAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
      prisma.incident.count({ where }),
    ]).then(([items, totalCount]) => ({ items, totalCount }));
  },

  // --- Signals & timeline ---
  createSignal(incidentId: string, signal: { signalType: string; sourceRef: string | null; relevanceScore: number; summary: string; rawData?: unknown }) {
    return prisma.incidentSignal.create({
      data: {
        incidentId,
        signalType: signal.signalType as never,
        sourceRef: signal.sourceRef,
        relevanceScore: signal.relevanceScore,
        summary: signal.summary,
        rawData: signal.rawData as Prisma.InputJsonValue | undefined,
      },
    });
  },

  listSignals(incidentId: string) {
    return prisma.incidentSignal.findMany({ where: { incidentId }, orderBy: { relevanceScore: "desc" } });
  },

  createTimelineEvent(incidentId: string, event: { occurredAt: Date; eventType: string; description: string; sourceRef?: string | null }) {
    return prisma.incidentTimelineEvent.create({ data: { incidentId, ...event } });
  },

  listTimeline(incidentId: string) {
    return prisma.incidentTimelineEvent.findMany({ where: { incidentId }, orderBy: { occurredAt: "asc" } });
  },

  // --- Root cause & recommendations ---
  upsertRootCause(
    incidentId: string,
    data: {
      summary: string;
      mostLikelyCause: string;
      confidenceScore: number;
      responsibleCommitSha: string | null;
      responsiblePullRequestId: string | null;
      responsibleServiceId: string | null;
      responsibleUserId: string | null;
      rollbackRecommended: boolean;
    },
  ) {
    return prisma.rootCauseAnalysis.upsert({
      where: { incidentId },
      create: { incidentId, ...data },
      update: data,
    });
  },

  findRootCause(incidentId: string) {
    return prisma.rootCauseAnalysis.findUnique({ where: { incidentId } });
  },

  createRecommendation(
    incidentId: string,
    data: {
      type: string;
      title: string;
      description: string;
      rationale: string;
      priority: string;
      estimatedImpact: string | null;
      confidenceScore: number;
    },
  ) {
    return prisma.recommendation.create({ data: { incidentId, ...data } as Prisma.RecommendationUncheckedCreateInput });
  },

  listRecommendations(incidentId: string) {
    return prisma.recommendation.findMany({ where: { incidentId }, orderBy: { priority: "desc" } });
  },

  // --- Postmortem ---
  upsertPostmortem(
    incidentId: string,
    organizationId: string,
    data: {
      executiveSummary: string;
      timelineMarkdown: string;
      rootCauseMarkdown: string;
      contributingFactors: string | null;
      customerImpact: string | null;
      recoverySteps: string | null;
      lessonsLearned: string | null;
      actionItems: unknown;
    },
  ) {
    return prisma.postmortem.upsert({
      where: { incidentId },
      create: { incidentId, organizationId, ...data, actionItems: data.actionItems as Prisma.InputJsonValue | undefined },
      update: { ...data, actionItems: data.actionItems as Prisma.InputJsonValue | undefined },
    });
  },

  findPostmortemByIncident(incidentId: string) {
    return prisma.postmortem.findUnique({ where: { incidentId } });
  },

  findPostmortemByOrgAndId(organizationId: string, id: string) {
    return prisma.postmortem.findFirst({ where: { id, organizationId } });
  },
};
