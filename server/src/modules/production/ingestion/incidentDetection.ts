import { ConflictError } from "../../../common/errors/AppError.ts";
import { logger } from "../../../config/logger.ts";
import { prisma } from "../../../database/prisma.ts";
import { taskService } from "../../tasks/task.service.ts";
import { productionRepository } from "../production.repository.ts";

const SEVERITY_FROM_LABEL: Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
  critical: "CRITICAL",
  page: "CRITICAL",
  high: "HIGH",
  warning: "MEDIUM",
  info: "LOW",
};

function resolveSeverity(labels: Record<string, string>): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const raw = (labels.severity ?? "warning").toLowerCase();
  return SEVERITY_FROM_LABEL[raw] ?? "MEDIUM";
}

/** The actual "detection" rule for this slice: a firing alert whose `service`
 * label matches a registered Service opens (or reuses) an Incident and kicks
 * off the incident-analysis Task. Alerts without a matching Service, or
 * `resolved` alerts, don't create incidents - resolving an incident is a
 * separate, explicit action left for a later phase. */
export async function detectIncidentFromAlert(
  organizationId: string,
  integrationId: string | null,
  status: "firing" | "resolved",
  labels: Record<string, string>,
  annotations: Record<string, string>,
): Promise<void> {
  if (status !== "firing") return;

  const serviceName = labels.service;
  if (!serviceName) {
    logger.info({ organizationId, labels }, "Alert has no service label - cannot map to a Service, skipping incident detection");
    return;
  }

  const services = await productionRepository.listServices(organizationId);
  const service = services.find((s) => s.name === serviceName);
  if (!service) {
    logger.info({ organizationId, serviceName }, "Alert's service label doesn't match any registered Service, skipping");
    return;
  }

  const existing = await productionRepository.findOpenIncidentForService(organizationId, service.id);
  if (existing) {
    logger.info({ incidentId: existing.id }, "An incident is already open for this service - not creating a duplicate");
    return;
  }

  const title = annotations.summary || labels.alertname || `Incident on ${service.name}`;
  const incident = await productionRepository.createIncident({
    organizationId,
    serviceId: service.id,
    title,
    severity: resolveSeverity(labels),
  });

  // Auto-triggered tasks need a real actor for createdById, matching the
  // pattern webhook.service.ts uses (repo.importedById) - a Service may not
  // have an explicit owner yet, so fall back to the organization's owner.
  const actorId = service.ownerUserId ?? (await prisma.organization.findUnique({ where: { id: organizationId } }))?.ownerId;
  if (!actorId) {
    logger.warn({ incidentId: incident.id }, "No owner available to attribute the analysis task to - incident created but not auto-analyzed");
    return;
  }

  try {
    const task = await taskService.enqueueTask(organizationId, actorId, `Investigate incident: ${title}`, undefined, "incident-analysis", {
      incidentId: incident.id,
    });
    await productionRepository.attachTask(incident.id, task.id);
    logger.info({ incidentId: incident.id, taskId: task.id }, "Detected incident and enqueued analysis task");
  } catch (err) {
    if (err instanceof ConflictError) {
      logger.info({ incidentId: incident.id }, "Organization already has a task in progress - incident created, analysis will need to be started manually");
      return;
    }
    throw err;
  }
}
