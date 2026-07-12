import { NotFoundError } from "../../common/errors/AppError.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { analysisRepository } from "./analysis.repository.ts";

const SCORE_LABELS: [label: string, key: string][] = [
  ["Overall", "overallScore"],
  ["Architecture", "architectureScore"],
  ["Security", "securityScore"],
  ["Performance", "performanceScore"],
  ["Maintainability", "maintainabilityScore"],
  ["Scalability", "scalabilityScore"],
  ["Modularity", "modularityScore"],
  ["Layering", "layeringScore"],
  ["Documentation", "documentationScore"],
  ["Complexity", "complexityScore"],
  ["Technical Debt", "technicalDebtScore"],
];

async function loadReportData(repositoryId: string) {
  const repository = await repoRepository.findById(repositoryId);
  if (!repository) {
    throw new NotFoundError(`Repository ${repositoryId} not found`);
  }

  const analysis = await analysisRepository.findLatestByRepository(repositoryId);
  if (!analysis) {
    throw new NotFoundError("No completed analysis found for this repository");
  }

  const { items: findings } = await analysisRepository.listFindings(analysis.id, {
    page: 1,
    pageSize: 500,
    sortBy: "severity",
    sortOrder: "desc",
  });

  return { repository, analysis, findings };
}

export async function generateJsonReport(repositoryId: string) {
  const { repository, analysis, findings } = await loadReportData(repositoryId);
  return {
    repository: { id: repository.id, name: repository.fullName },
    analysis: analysis as unknown as Record<string, unknown>,
    scores: Object.fromEntries(
      SCORE_LABELS.map(([, key]) => [key, (analysis as unknown as Record<string, unknown>)[key]]),
    ),
    architectureSummary: analysis.architectureSummary,
    findings,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateMarkdownReport(repositoryId: string): Promise<string> {
  const { repository, analysis, findings } = await loadReportData(repositoryId);
  const analysisRecord = analysis as unknown as Record<string, unknown>;

  const lines: string[] = [];
  lines.push(`# Engineering Analysis Report: ${repository.fullName}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Analysis completed: ${analysis.completedAt?.toISOString() ?? "N/A"}`);
  lines.push("");
  lines.push("## Scores");
  lines.push("");
  lines.push("| Metric | Score |");
  lines.push("| --- | --- |");
  for (const [label, key] of SCORE_LABELS) {
    lines.push(`| ${label} | ${analysisRecord[key] ?? "N/A"} |`);
  }
  lines.push("");
  lines.push("## Architecture Summary");
  lines.push("");
  lines.push(analysis.architectureSummary ?? "Not available.");
  lines.push("");
  lines.push("## Findings");
  lines.push("");

  if (findings.length === 0) {
    lines.push("No findings.");
  } else {
    for (const f of findings) {
      lines.push(`### [${f.severity}] ${f.title}`);
      lines.push("");
      lines.push(`- **Category**: ${f.category} / ${f.type}`);
      lines.push(`- **Priority**: ${f.priority ?? f.severity}`);
      lines.push(`- **Confidence**: ${f.confidence}%`);
      if (f.filePath) lines.push(`- **Location**: ${f.filePath}${f.startLine ? `:${f.startLine}` : ""}`);
      lines.push(`- **Explanation**: ${f.explanation}`);
      if (f.evidence) lines.push(`- **Evidence**: ${f.evidence}`);
      if (f.suggestedFix) lines.push(`- **Suggested Fix**: ${f.suggestedFix}`);
      if (f.estimatedImpact) lines.push(`- **Estimated Impact**: ${f.estimatedImpact}`);
      if (f.relatedFiles.length) lines.push(`- **Related Files**: ${f.relatedFiles.join(", ")}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
