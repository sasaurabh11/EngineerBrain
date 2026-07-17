import { indexingService } from "../../indexing/indexing.service.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";
import { listChangedPrFiles, resolveRepositoryWithOctokit, withRepositoryIdParam } from "./shared.ts";

const MAX_DEPENDENTS = 50;

interface PrDependencyImpactArgs {
  repository_id?: string;
  pull_number: number;
}

export const prDependencyImpactTool: AiTool<PrDependencyImpactArgs> = {
  name: "pr_dependency_impact",
  description:
    "Finds what else in the repository depends on (imports, calls, extends, implements, or uses) the files a pull request changes - " +
    "i.e. what else might break or need review if this PR is merged. Only covers files the indexer has parsed.",
  parameters: withRepositoryIdParam({ pull_number: { type: "number", description: "Pull request number" } }, ["pull_number"]),
  async execute(args, ctx: ToolContext) {
    const { repo, octokit } = await resolveRepositoryWithOctokit(ctx, args);
    const changedFiles = await listChangedPrFiles(octokit, repo, args.pull_number);
    const changedPaths = changedFiles.filter((f) => f.status !== "removed").map((f) => f.filename);

    if (changedPaths.length === 0) {
      return { repositoryId: repo.id, pullNumber: args.pull_number, message: "No analyzable files changed by this PR.", dependents: [] };
    }

    const dependents = await indexingService.findDependentsForFiles(repo.id, changedPaths);

    if (dependents.length === 0) {
      return {
        repositoryId: repo.id,
        pullNumber: args.pull_number,
        message:
          "No internal-code dependents were found for the files this PR changes. Note: today's indexer reliably resolves external " +
          "package imports but not all internal same-repo imports (e.g. path-aliased imports), so this is not a confident guarantee of " +
          "zero impact - treat it as 'nothing detected', not 'nothing depends on this'.",
        dependents: [],
      };
    }

    return {
      repositoryId: repo.id,
      pullNumber: args.pull_number,
      totalDependents: dependents.length,
      truncated: dependents.length > MAX_DEPENDENTS,
      dependents: dependents.slice(0, MAX_DEPENDENTS),
    };
  },
};
