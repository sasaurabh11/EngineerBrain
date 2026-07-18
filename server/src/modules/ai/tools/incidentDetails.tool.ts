import { NotFoundError } from "../../../common/errors/AppError.ts";
import { productionRepository } from "../../production/production.repository.ts";
import { productionService } from "../../production/production.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  incident_id: string;
}

export const incidentDetailsTool: AiTool<Args> = {
  name: "incident_details",
  description:
    "Gets everything known about one production incident by id: its status/severity, the correlated evidence (deployment, commit, PR, findings, " +
    "ownership), the timeline, root cause analysis (if generated), and recommendations. Use this to answer \"why is X failing\" or \"which deployment " +
    "caused this\" once you have an incident id from production_incidents.",
  parameters: {
    type: "object",
    properties: { incident_id: { type: "string", description: "Incident UUID" } },
    required: ["incident_id"],
  },
  async execute(args, ctx: ToolContext) {
    const incident = await productionRepository.findIncidentByOrgAndId(ctx.organizationId, args.incident_id);
    if (!incident) throw new NotFoundError("Incident not found");

    const [signals, timeline, rootCause, recommendations] = await Promise.all([
      productionRepository.listSignals(incident.id),
      productionRepository.listTimeline(incident.id),
      productionRepository.findRootCause(incident.id),
      productionRepository.listRecommendations(incident.id),
    ]);

    return {
      incident: productionService.toIncidentDto(incident),
      signals,
      timeline,
      rootCause,
      recommendations,
    };
  },
};
