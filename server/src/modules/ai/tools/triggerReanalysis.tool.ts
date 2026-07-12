import { analysisService } from "../../analysis/analysis.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

interface TriggerReanalysisArgs {
  repository_id?: string;
}

export const triggerReanalysisTool: AiTool<TriggerReanalysisArgs> = {
  name: "trigger_reanalysis",
  description: "Queues a fresh code-analysis run (health scores, findings) for a repository. Mutates state - requires approval.",
  parameters: withRepositoryIdParam({}),
  permission: "write",
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    await analysisService.enqueueAnalysis(repo.id, "MANUAL", ctx.userId);
    return { queued: true, repositoryId: repo.id };
  },
};
