import { NotFoundError } from "../../../common/errors/AppError.ts";
import { prisma } from "../../../database/prisma.ts";
import { productionRepository } from "../../production/production.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  incident_id: string;
}

/** Service-level blast radius only: other services sharing the same
 * repository (a common multi-service-per-repo setup) plus the incident's
 * own service. This platform doesn't yet have a cross-repository dependency
 * graph, so it can't trace "which other repos call this one" - for
 * code-level "what else depends on the changed files" within the SAME
 * repository, use the pr_dependency_impact tool against the responsible
 * pull request instead. Said explicitly here rather than implying a
 * guarantee this tool can't back up. */
export const blastRadiusTool: AiTool<Args> = {
  name: "blast_radius",
  description:
    "Estimates which other services might be affected by an incident, based on services sharing the same repository. For code-level " +
    "\"what else in the repo depends on the changed files\", use pr_dependency_impact against the incident's responsible pull request instead.",
  parameters: {
    type: "object",
    properties: { incident_id: { type: "string", description: "Incident UUID" } },
    required: ["incident_id"],
  },
  async execute(args, ctx: ToolContext) {
    const incident = await productionRepository.findIncidentByOrgAndId(ctx.organizationId, args.incident_id);
    if (!incident) throw new NotFoundError("Incident not found");
    if (!incident.serviceId) {
      return { message: "This incident has no associated service yet, so blast radius cannot be estimated.", affectedServices: [] };
    }

    const service = await prisma.service.findUnique({ where: { id: incident.serviceId } });
    if (!service?.repositoryId) {
      return { message: "The affected service has no linked repository, so blast radius cannot be estimated beyond itself.", affectedServices: [{ id: service?.id, name: service?.name }] };
    }

    const relatedServices = await prisma.service.findMany({
      where: { organizationId: ctx.organizationId, repositoryId: service.repositoryId, id: { not: service.id } },
    });

    return {
      primaryService: { id: service.id, name: service.name },
      affectedServices: relatedServices.map((s) => ({ id: s.id, name: s.name, criticality: s.criticality })),
      note:
        relatedServices.length === 0
          ? "No other services share this repository - no cross-repository dependency graph exists yet, so this only reflects same-repo services."
          : "These services share the same repository as the affected one and may deploy from the same codebase changes.",
    };
  },
};
