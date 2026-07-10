import { analysisRepository } from "../../analysis/analysis.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

interface ExplainPatternArgs {
  pattern_name: string;
  repository_id?: string;
}

export const explainPatternTool: AiTool<ExplainPatternArgs> = {
  name: "explain_pattern",
  description:
    "Looks up real, AI-confirmed instances of a design pattern (Singleton, Factory, Repository, Observer, Builder) detected in this repository, so an explanation can reference actual code instead of a generic textbook definition.",
  parameters: withRepositoryIdParam(
    { pattern_name: { type: "string", description: "Pattern name, e.g. Singleton, Factory, Repository, Observer, Builder" } },
    ["pattern_name"],
  ),
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const analysis = await analysisRepository.findLatestByRepository(repo.id);
    if (!analysis) {
      return { found: false, message: "No completed analysis found for this repository." };
    }

    const findings = await analysisRepository.listFindings(analysis.id, "PATTERN");
    const matches = findings.filter((f) => f.type.toLowerCase() === args.pattern_name.toLowerCase());

    return {
      patternName: args.pattern_name,
      repositoryId: repo.id,
      instancesFound: matches.length,
      instances: matches.map((f) => ({
        title: f.title,
        explanation: f.explanation,
        confidence: f.confidence,
        filePath: f.filePath,
        repositoryId: repo.id,
      })),
    };
  },
};
