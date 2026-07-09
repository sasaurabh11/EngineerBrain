import { indexingService } from "../../indexing/indexing.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

const MAX_EDGES = 200;

interface DependencyGraphArgs {
  repository_id?: string;
}

export const dependencyGraphTool: AiTool<DependencyGraphArgs> = {
  name: "dependency_graph",
  description:
    "Returns import, inheritance (extends), and interface implementation relationships between symbols in a repository. Use this to answer questions about what depends on what, or class hierarchies.",
  parameters: withRepositoryIdParam({}),
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const edges = await indexingService.listGraphEdgesForAssistant(repo.id);
    return {
      repositoryName: repo.name,
      totalEdges: edges.length,
      truncated: edges.length > MAX_EDGES,
      edges: edges.slice(0, MAX_EDGES),
    };
  },
};
