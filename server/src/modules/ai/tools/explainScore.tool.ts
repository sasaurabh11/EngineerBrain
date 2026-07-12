import type { FindingCategory } from "@prisma/client";
import { analysisRepository } from "../../analysis/analysis.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

const SCORE_FIELDS = {
  overall: "overallScore",
  architecture: "architectureScore",
  security: "securityScore",
  performance: "performanceScore",
  maintainability: "maintainabilityScore",
  scalability: "scalabilityScore",
  modularity: "modularityScore",
  layering: "layeringScore",
  documentation: "documentationScore",
  complexity: "complexityScore",
  technical_debt: "technicalDebtScore",
} as const;

type ScoreType = keyof typeof SCORE_FIELDS;

// Maintainability/complexity/documentation are whole-file formulas, not a
// per-finding penalty tally like the other scores - the closest concrete
// QUALITY findings a reader can inspect are surfaced as "related" instead.
const RELATED_CATEGORY: Record<ScoreType, FindingCategory | null> = {
  architecture: "DEPENDENCY",
  security: "SECURITY",
  performance: "PERFORMANCE",
  maintainability: "QUALITY",
  scalability: "PERFORMANCE",
  modularity: "DEPENDENCY",
  layering: "DEPENDENCY",
  documentation: "QUALITY",
  complexity: "QUALITY",
  technical_debt: null,
  overall: null,
};

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

interface ExplainScoreArgs {
  score_type: ScoreType;
  repository_id?: string;
}

export const explainScoreTool: AiTool<ExplainScoreArgs> = {
  name: "explain_score",
  description:
    "Returns a repository's health score (overall/architecture/security/performance/maintainability/scalability/modularity/layering/documentation/complexity/technical_debt) along with the specific findings that drove it and, for architecture, the AI-generated architecture summary - so you can explain WHY the score is what it is rather than giving a generic definition.",
  parameters: withRepositoryIdParam(
    {
      score_type: {
        type: "string",
        enum: Object.keys(SCORE_FIELDS),
        description: "Which score to explain",
      },
    },
    ["score_type"],
  ),
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const analysis = await analysisRepository.findLatestByRepository(repo.id);
    if (!analysis) {
      return { found: false, message: "No completed analysis found for this repository." };
    }

    const scoreField = SCORE_FIELDS[args.score_type];
    const score = (analysis as unknown as Record<string, number | null>)[scoreField];
    const category = RELATED_CATEGORY[args.score_type];

    const findings = await analysisRepository.listAllFindings(analysis.id, category ?? undefined);
    const topFindings = [...findings]
      .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
      .slice(0, 10)
      .map((f) => ({ title: f.title, severity: f.severity, filePath: f.filePath, repositoryId: repo.id }));

    return {
      scoreType: args.score_type,
      score,
      repositoryId: repo.id,
      contributingFindingsCount: findings.length,
      topFindings,
      architectureSummary: args.score_type === "architecture" ? analysis.architectureSummary : undefined,
    };
  },
};
