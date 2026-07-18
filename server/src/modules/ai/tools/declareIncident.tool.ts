import { productionService } from "../../production/production.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  service_id?: string;
}

export const declareIncidentTool: AiTool<Args> = {
  name: "declare_incident",
  description:
    "Manually declares a new production incident (as opposed to one auto-detected from a metrics alert) and immediately starts the same real " +
    "correlation/root-cause/recommendation pipeline. Use this when a user asks to open/declare/report an incident.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short incident title, e.g. \"Checkout returning 500s\"" },
      severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      service_id: { type: "string", description: "Service UUID this incident affects, if known" },
    },
    required: ["title", "severity"],
  },
  async execute(args, ctx: ToolContext) {
    return productionService.declareIncident(ctx.organizationId, ctx.userId, args.title, args.severity, args.service_id);
  },
};
