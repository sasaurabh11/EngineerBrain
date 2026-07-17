import { ForbiddenError, NotFoundError } from "../../../common/errors/AppError.ts";
import { callAiService } from "../../../infra/aiService/aiServiceClient.ts";
import { getInstallationAccessToken, getInstallationOctokit } from "../../../infra/github/octokitApp.ts";
import { githubRepository } from "../../github/github.repository.ts";
import { indexingRepository } from "../../indexing/indexing.repository.ts";
import { repoRepository } from "../../repo/repo.repository.ts";
import type { ToolContext } from "./tool.types.ts";

const MAX_SYMBOL_SOURCE_CHARS = 12_000;

const REPOSITORY_ID_PARAM = {
  repository_id: {
    type: "string",
    description: "Repository UUID. Required only when the conversation is not scoped to a single repository.",
  },
};

export function withRepositoryIdParam(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: "object",
    properties: { ...properties, ...REPOSITORY_ID_PARAM },
    required,
  };
}

export async function resolveRepository(ctx: ToolContext, args: { repository_id?: string }) {
  const repositoryId = ctx.repositoryId ?? args.repository_id;
  if (!repositoryId) {
    throw new NotFoundError("repository_id is required when the conversation is not scoped to a single repository");
  }

  const repo = await repoRepository.findByOrgAndId(ctx.organizationId, repositoryId);
  if (!repo) {
    throw new ForbiddenError("Repository not found in this organization");
  }

  return repo;
}

export async function resolveRepositoryWithOctokit(ctx: ToolContext, args: { repository_id?: string }) {
  const repo = await resolveRepository(ctx, args);
  const installation = await githubRepository.findByOrganizationId(ctx.organizationId);
  if (!installation) {
    throw new NotFoundError("GitHub is not connected for this organization");
  }
  const octokit = await getInstallationOctokit(Number(installation.githubInstallationId));
  return { repo, octokit };
}

export async function fetchFileContent(
  organizationId: string,
  repo: { id: string; cloneUrl: string; defaultBranch: string },
  filePath: string,
): Promise<string> {
  const installation = await githubRepository.findByOrganizationId(organizationId);
  if (!installation) {
    throw new NotFoundError("GitHub is not connected for this organization");
  }

  const accessToken = await getInstallationAccessToken(Number(installation.githubInstallationId));

  const response = await callAiService<{ content: string }>("/internal/file-content", {
    body: {
      repository_id: repo.id,
      clone_url: repo.cloneUrl,
      access_token: accessToken,
      default_branch: repo.defaultBranch,
      file_path: filePath,
    },
  });

  return response.content;
}

export async function listChangedPrFiles(
  octokit: Awaited<ReturnType<typeof resolveRepositoryWithOctokit>>["octokit"],
  repo: { ownerLogin: string; name: string },
  pullNumber: number,
) {
  return octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
    owner: repo.ownerLogin,
    repo: repo.name,
    pull_number: pullNumber,
    per_page: 100,
  });
}

export async function findAndReadSymbol(ctx: ToolContext, args: { name: string; repository_id?: string }, kinds: string[]) {
  const repo = await resolveRepository(ctx, args);
  const matches = await indexingRepository.findSymbolsByName(repo.id, kinds, args.name);

  if (matches.length === 0) {
    return { found: false as const, message: `No matching symbol named "${args.name}" found in ${repo.name}` };
  }

  const results = await Promise.all(
    matches.map(async (symbol) => {
      const fileContent = await fetchFileContent(ctx.organizationId, repo, symbol.file.path);
      const lines = fileContent.split("\n");
      let source = lines.slice(symbol.startLine - 1, symbol.endLine).join("\n");
      let truncated = false;
      if (source.length > MAX_SYMBOL_SOURCE_CHARS) {
        source = source.slice(0, MAX_SYMBOL_SOURCE_CHARS);
        truncated = true;
      }

      return {
        name: symbol.name,
        kind: symbol.kind,
        filePath: symbol.file.path,
        repositoryId: repo.id,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        signature: symbol.signature,
        docComment: symbol.docComment,
        source,
        truncated,
      };
    }),
  );

  return { found: true as const, matches: results };
}
