import { callAiService } from "../../../infra/aiService/aiServiceClient.ts";
import { getInstallationAccessToken } from "../../../infra/github/octokitApp.ts";
import type { AiAnalysisResult } from "../../analysis/analysis.types.ts";
import { githubRepository } from "../../github/github.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { listChangedPrFiles, resolveRepositoryWithOctokit, withRepositoryIdParam } from "./shared.ts";

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
const MAX_FINDINGS = 25;

interface PrStaticAnalysisArgs {
  repository_id?: string;
  pull_number: number;
}

export const prStaticAnalysisTool: AiTool<PrStaticAnalysisArgs> = {
  name: "pr_static_analysis",
  description:
    "Runs the same deterministic static analysis used for repository health (SOLID, security, performance, dependency findings) " +
    "against a pull request's head commit, scoped to only the files that PR actually changes - not the whole repository.",
  parameters: withRepositoryIdParam(
    { pull_number: { type: "number", description: "Pull request number" } },
    ["pull_number"],
  ),
  async execute(args, ctx: ToolContext) {
    const { repo, octokit } = await resolveRepositoryWithOctokit(ctx, args);

    const [{ data: pr }, changedFiles, installation] = await Promise.all([
      octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner: repo.ownerLogin,
        repo: repo.name,
        pull_number: args.pull_number,
      }),
      listChangedPrFiles(octokit, repo, args.pull_number),
      githubRepository.findByOrganizationId(ctx.organizationId),
    ]);

    if (!installation) {
      return { found: false, message: "GitHub is not connected for this organization." };
    }

    const accessToken = await getInstallationAccessToken(Number(installation.githubInstallationId));
    const changedPaths = changedFiles.filter((f) => f.status !== "removed").map((f) => f.filename);

    if (changedPaths.length === 0) {
      return { repositoryId: repo.id, pullNumber: args.pull_number, message: "No analyzable files changed by this PR.", findings: [] };
    }

    const result = await callAiService<AiAnalysisResult>("/internal/analyze", {
      body: {
        organization_id: ctx.organizationId,
        repository_id: repo.id,
        clone_url: repo.cloneUrl,
        access_token: accessToken,
        default_branch: repo.defaultBranch,
        commit_sha: pr.head.sha,
        changed_files: changedPaths,
      },
      timeoutMs: 5 * 60 * 1000,
    });

    const topFindings = [...result.findings]
      .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
      .slice(0, MAX_FINDINGS)
      .map((f) => ({
        category: f.category,
        type: f.type,
        severity: f.severity,
        title: f.title,
        explanation: f.explanation,
        filePath: f.file_path,
        startLine: f.start_line,
        confidence: f.confidence,
        suggestedFix: f.suggested_fix,
      }));

    return {
      repositoryId: repo.id,
      pullNumber: args.pull_number,
      filesAnalyzed: changedPaths.length,
      totalFindings: result.findings.length,
      findings: topFindings,
    };
  },
};
