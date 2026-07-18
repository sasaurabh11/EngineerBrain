import { NotFoundError } from "../../../common/errors/AppError.ts";
import { productionRepository } from "../../production/production.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  incident_id: string;
}

/** Read-only: surfaces the existing rollback signal for an incident. This
 * tool never performs a rollback itself - it only reports what the root
 * cause analysis and recommendation engine already concluded. */
export const rollbackRecommendationTool: AiTool<Args> = {
  name: "rollback_recommendation",
  description: "Reports whether a rollback is recommended for an incident, and why, based on its root cause analysis and recommendations. Does not perform any rollback.",
  parameters: {
    type: "object",
    properties: { incident_id: { type: "string", description: "Incident UUID" } },
    required: ["incident_id"],
  },
  async execute(args, ctx: ToolContext) {
    const incident = await productionRepository.findIncidentByOrgAndId(ctx.organizationId, args.incident_id);
    if (!incident) throw new NotFoundError("Incident not found");

    const [rootCause, recommendations] = await Promise.all([
      productionRepository.findRootCause(incident.id),
      productionRepository.listRecommendations(incident.id),
    ]);
    const rollbackRecommendations = recommendations.filter((r) => r.type === "ROLLBACK");

    if (!rootCause) {
      return { rollbackRecommended: false, reason: "Root cause analysis has not run yet for this incident.", recommendations: [] };
    }

    return {
      rollbackRecommended: rootCause.rollbackRecommended,
      reason: rootCause.rollbackRecommended
        ? `Root cause analysis (confidence ${rootCause.confidenceScore}%) points to: ${rootCause.mostLikelyCause}`
        : "Root cause analysis did not flag this incident as needing a rollback.",
      responsibleDeploymentId: incident.deploymentId,
      recommendations: rollbackRecommendations,
    };
  },
};
