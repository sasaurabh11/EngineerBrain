import { NotFoundError } from "../../../common/errors/AppError.ts";
import { prisma } from "../../../database/prisma.ts";
import {
  correlateCommit,
  correlateDeployment,
  correlateMostRecentMergedPullRequest,
  correlateOwnership,
  correlateRecentFindings,
  type CorrelatedSignal,
} from "../../production/engine/correlators.ts";
import { productionRepository } from "../../production/production.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  incident_id: string;
}

/** Runs every deterministic correlator for one incident, persists the
 * results as IncidentSignal + IncidentTimelineEvent rows, and returns them -
 * this is the "gather -> correlate" tool step in the incident-analysis
 * workflow (see tasks/workflows/incidentAnalysis.workflow.ts). No LLM calls
 * happen here; the subsequent root-cause agent step reasons only over this
 * tool's output. */
export const correlateIncidentEvidenceTool: AiTool<Args> = {
  name: "correlate_incident_evidence",
  description:
    "Runs deterministic correlation (deployment history, the deploying commit, the likely pull request, related static-analysis findings, and " +
    "ownership) for one incident and persists the results as evidence. Call this before reasoning about root cause - never guess at a cause " +
    "without first calling this.",
  parameters: {
    type: "object",
    properties: { incident_id: { type: "string", description: "Incident UUID" } },
    required: ["incident_id"],
  },
  async execute(args, ctx: ToolContext) {
    const incident = await productionRepository.findIncidentByOrgAndId(ctx.organizationId, args.incident_id);
    if (!incident) throw new NotFoundError("Incident not found");

    const service = incident.serviceId ? await prisma.service.findUnique({ where: { id: incident.serviceId } }) : null;
    const repositoryId = service?.repositoryId ?? null;

    const deploymentSignal = await correlateDeployment(ctx.organizationId, incident.serviceId, incident.detectedAt);
    const deployment = deploymentSignal?.sourceRef ? await productionRepository.findDeploymentById(deploymentSignal.sourceRef) : null;

    const [commitSignal, pullRequestSignal, findingSignals] = await Promise.all([
      correlateCommit(repositoryId, deployment?.commitSha ?? null),
      correlateMostRecentMergedPullRequest(repositoryId, deployment?.deployedAt ?? incident.detectedAt),
      correlateRecentFindings(repositoryId),
    ]);

    const commitAuthorEmail = commitSignal?.rawData?.authorEmail as string | undefined;
    const ownershipSignal = await correlateOwnership(service?.ownerUserId ?? null, commitAuthorEmail ?? null);

    const signals: CorrelatedSignal[] = [deploymentSignal, commitSignal, pullRequestSignal, ownershipSignal, ...findingSignals].filter(
      (s): s is CorrelatedSignal => s !== null,
    );

    for (const signal of signals) {
      await productionRepository.createSignal(incident.id, signal);
    }

    if (deployment) {
      await productionRepository.createTimelineEvent(incident.id, {
        occurredAt: deployment.deployedAt,
        eventType: "DEPLOYMENT",
        description: `Deployment ${deployment.version ?? deployment.commitSha?.slice(0, 7) ?? deployment.id} to "${deployment.environment}"`,
        sourceRef: deployment.id,
      });
      if (!incident.deploymentId) {
        await productionRepository.attachDeployment(incident.id, deployment.id);
      }
    }
    await productionRepository.createTimelineEvent(incident.id, {
      occurredAt: incident.detectedAt,
      eventType: "INCIDENT_DETECTED",
      description: incident.title,
    });

    return { incidentId: incident.id, signalCount: signals.length, signals };
  },
};
