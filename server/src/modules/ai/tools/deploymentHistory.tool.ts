import { productionService } from "../../production/production.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  service_id?: string;
  environment?: string;
}

export const deploymentHistoryTool: AiTool<Args> = {
  name: "deployment_history",
  description: "Lists recent deployments, optionally filtered by service or environment. Use this to answer \"show deployment history\" or \"what was deployed recently\".",
  parameters: {
    type: "object",
    properties: {
      service_id: { type: "string", description: "Service UUID to filter by" },
      environment: { type: "string", description: "Environment/branch name to filter by, e.g. \"production\" or \"main\"" },
    },
  },
  async execute(args, ctx: ToolContext) {
    const { items, totalCount } = await productionService.listDeployments(ctx.organizationId, {
      serviceId: args.service_id,
      environment: args.environment,
      page: 1,
      pageSize: 20,
    });
    return { totalCount, deployments: items };
  },
};
