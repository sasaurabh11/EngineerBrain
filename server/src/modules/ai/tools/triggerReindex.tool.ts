import { indexingService } from "../../indexing/indexing.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

interface TriggerReindexArgs {
  repository_id?: string;
}

export const triggerReindexTool: AiTool<TriggerReindexArgs> = {
  name: "trigger_reindex",
  description: "Queues a fresh knowledge-base index (symbols, embeddings) for a repository. Mutates state - requires approval.",
  parameters: withRepositoryIdParam({}),
  permission: "write",
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    await indexingService.enqueueIndex(repo.id, "MANUAL", ctx.userId);
    return { queued: true, repositoryId: repo.id };
  },
};
