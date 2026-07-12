import { analysisRepository } from "../../analysis/analysis.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { fetchFileContent, resolveRepository, withRepositoryIdParam } from "./shared.ts";

interface ExplainFindingArgs {
  finding_id?: string;
  file_path?: string;
  type?: string;
  repository_id?: string;
}

export const explainFindingTool: AiTool<ExplainFindingArgs> = {
  name: "explain_finding",
  description:
    "Fetches a specific code-analysis finding (by finding_id, or by file_path/type) along with the current source code around it, so you can give a grounded, code-specific explanation instead of a generic one.",
  parameters: withRepositoryIdParam(
    {
      finding_id: { type: "string", description: "Exact finding UUID, if already known" },
      file_path: { type: "string", description: "File path to search within (combine with type if finding_id is unknown)" },
      type: { type: "string", description: "Finding type, e.g. HIGH_COMPLEXITY, CIRCULAR_DEPENDENCY, SRP_CANDIDATE, HARDCODED_SECRET" },
    },
    [],
  ),
  async execute(args, ctx: ToolContext) {
    let finding = args.finding_id ? await analysisRepository.findFindingById(args.finding_id) : null;

    if (!finding) {
      const repo = await resolveRepository(ctx, args);
      const latest = await analysisRepository.findLatestByRepository(repo.id);
      if (!latest) {
        return { found: false, message: "No completed analysis found for this repository." };
      }
      const candidates = await analysisRepository.listAllFindings(latest.id);
      finding = candidates.find((f) => (!args.file_path || f.filePath === args.file_path) && (!args.type || f.type === args.type)) ?? null;
    }

    if (!finding) {
      return { found: false, message: "No matching finding found." };
    }

    const analysis = await analysisRepository.findById(finding.analysisId);
    if (!analysis) {
      return { found: false, message: "Finding exists but its analysis run could not be found." };
    }

    const repo = await resolveRepository(ctx, { repository_id: analysis.repositoryId });

    let currentSource: string | null = null;
    if (finding.filePath) {
      try {
        const content = await fetchFileContent(ctx.organizationId, repo, finding.filePath);
        const lines = content.split("\n");
        const start = finding.startLine ?? 1;
        const end = finding.endLine ?? lines.length;
        currentSource = lines.slice(Math.max(0, start - 3), end + 2).join("\n");
      } catch {
        currentSource = null;
      }
    }

    return {
      found: true,
      category: finding.category,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      storedExplanation: finding.explanation,
      suggestedFix: finding.suggestedFix,
      confidence: finding.confidence,
      filePath: finding.filePath,
      repositoryId: repo.id,
      startLine: finding.startLine,
      endLine: finding.endLine,
      currentSource,
    };
  },
};
