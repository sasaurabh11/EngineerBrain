import { DEFAULT_AI_PROVIDER_CONFIG } from "../../../infra/aiService/providerConfig.ts";
import { productionService } from "../../production/production.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  incident_id: string;
}

export const generatePostmortemTool: AiTool<Args> = {
  name: "generate_postmortem",
  description:
    "Generates (or regenerates) a full postmortem document for an incident that already has a root cause analysis: executive summary, timeline, " +
    "root cause, contributing factors, customer impact, recovery steps, lessons learned, and action items. This drafts an internal document only - " +
    "it does not publish or send anything externally.",
  parameters: {
    type: "object",
    properties: { incident_id: { type: "string", description: "Incident UUID" } },
    required: ["incident_id"],
  },
  async execute(args, ctx: ToolContext) {
    return productionService.generatePostmortem(ctx.organizationId, args.incident_id, ctx.providerConfig ?? DEFAULT_AI_PROVIDER_CONFIG);
  },
};
