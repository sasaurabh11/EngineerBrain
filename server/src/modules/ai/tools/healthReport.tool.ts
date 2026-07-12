import { analysisRepository } from "../../analysis/analysis.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepository, withRepositoryIdParam } from "./shared.ts";

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
const MAX_FINDINGS = 15;

interface HealthReportArgs {
  repository_id?: string;
}

export const healthReportTool: AiTool<HealthReportArgs> = {
  name: "health_report",
  description:
    "Returns a repository's latest code-analysis health scores (overall/architecture/security/performance/maintainability) plus its highest-severity findings. Use this first for any broad question like 'what's wrong with this repo' before drilling into a specific finding.",
  parameters: withRepositoryIdParam({}),
  async execute(args, ctx: ToolContext) {
    const repo = await resolveRepository(ctx, args);
    const analysis = await analysisRepository.findLatestByRepository(repo.id);
    if (!analysis) {
      return { found: false, message: "No completed analysis found for this repository yet." };
    }

    const findings = await analysisRepository.listAllFindings(analysis.id);
    const topFindings = [...findings]
      .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
      .slice(0, MAX_FINDINGS)
      .map((f) => ({
        id: f.id,
        category: f.category,
        type: f.type,
        severity: f.severity,
        title: f.title,
        filePath: f.filePath,
        repositoryId: repo.id,
      }));

    return {
      repositoryId: repo.id,
      overallScore: analysis.overallScore,
      architectureScore: analysis.architectureScore,
      securityScore: analysis.securityScore,
      performanceScore: analysis.performanceScore,
      maintainabilityScore: analysis.maintainabilityScore,
      scalabilityScore: analysis.scalabilityScore,
      modularityScore: analysis.modularityScore,
      layeringScore: analysis.layeringScore,
      documentationScore: analysis.documentationScore,
      complexityScore: analysis.complexityScore,
      technicalDebtScore: analysis.technicalDebtScore,
      architectureSummary: analysis.architectureSummary,
      totalFindings: findings.length,
      topFindings,
    };
  },
};
