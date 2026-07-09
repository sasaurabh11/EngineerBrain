import { indexingService } from "../../indexing/indexing.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

interface FrameworkDetectionArgs {
  repository_id?: string;
}

export const frameworkDetectionTool: AiTool<FrameworkDetectionArgs> = {
  name: "framework_detection",
  description: "Returns the frameworks and major libraries detected in a repository (e.g. FastAPI, Express, Spring Boot, React).",
  parameters: withRepositoryIdParam({}),
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const status = await indexingService.getStatus(repo.id);
    return { repositoryName: repo.name, detectedFrameworks: status.detectedFrameworks };
  },
};
