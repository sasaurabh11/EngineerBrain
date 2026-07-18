import { productionService } from "../../production/production.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  status?: "DETECTED" | "INVESTIGATING" | "ROOT_CAUSED" | "RESOLVED" | "CLOSED";
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  serviceId?: string;
}

export const productionIncidentsTool: AiTool<Args> = {
  name: "production_incidents",
  description:
    "Lists production incidents for this organization, optionally filtered by status, severity, or service. Use this to answer " +
    "questions like \"what's broken right now\", \"what incidents happened this week\", or \"is checkout having issues\".",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["DETECTED", "INVESTIGATING", "ROOT_CAUSED", "RESOLVED", "CLOSED"] },
      severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      serviceId: { type: "string", description: "Service UUID to filter by" },
    },
  },
  async execute(args, ctx: ToolContext) {
    const { items, totalCount } = await productionService.listIncidents(ctx.organizationId, {
      status: args.status,
      severity: args.severity,
      serviceId: args.serviceId,
      page: 1,
      pageSize: 20,
    });
    return { totalCount, incidents: items };
  },
};
