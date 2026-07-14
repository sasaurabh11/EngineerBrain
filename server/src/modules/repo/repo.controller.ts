import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { repoService } from "./repo.service.ts";
import type { ListRepositoriesFilters } from "./repo.types.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

function getQueryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" ? value : undefined;
}

export const repoController = {
  async listAvailable(req: Request, res: Response) {
    const repos = await repoService.listAvailable(req.organization!.id);
    sendSuccess(res, repos);
  },

  async list(req: Request, res: Response) {
    const filters: ListRepositoriesFilters = {
      search: getQueryString(req, "search"),
      language: getQueryString(req, "language"),
      sort: getQueryString(req, "sort") as ListRepositoriesFilters["sort"],
    };
    const repos = await repoService.listImported(req.organization!.id, filters);
    sendSuccess(res, repos);
  },

  async get(req: Request, res: Response) {
    const repo = await repoService.getById(req.organization!.id, getParam(req, "repositoryId"));
    sendSuccess(res, repo);
  },

  async import(req: Request, res: Response) {
    const repos = await repoService.importRepositories(req.organization!.id, req.dbUser!.id, req.body.githubRepoIds);
    sendSuccess(res, repos, 201);
  },

  async remove(req: Request, res: Response) {
    await repoService.remove(req.organization!.id, getParam(req, "repositoryId"));
    sendSuccess(res, { deleted: true });
  },

  async sync(req: Request, res: Response) {
    const repo = await repoService.triggerSync(req.organization!.id, getParam(req, "repositoryId"), req.dbUser!.id);
    sendSuccess(res, repo);
  },

  async branches(req: Request, res: Response) {
    const branches = await repoService.listBranches(req.organization!.id, getParam(req, "repositoryId"));
    sendSuccess(res, branches);
  },

  async commits(req: Request, res: Response) {
    const commits = await repoService.listCommits(req.organization!.id, getParam(req, "repositoryId"));
    sendSuccess(res, commits);
  },

  async contributors(req: Request, res: Response) {
    const contributors = await repoService.listContributors(req.organization!.id, getParam(req, "repositoryId"));
    sendSuccess(res, contributors);
  },

  async pullRequests(req: Request, res: Response) {
    const pulls = await repoService.listPullRequests(req.organization!.id, getParam(req, "repositoryId"));
    sendSuccess(res, pulls);
  },

  async issues(req: Request, res: Response) {
    const issues = await repoService.listIssues(req.organization!.id, getParam(req, "repositoryId"));
    sendSuccess(res, issues);
  },

  async fileContent(req: Request, res: Response) {
    const path = getQueryString(req, "path")!.trim();
    const file = await repoService.getFileContent(req.organization!.id, getParam(req, "repositoryId"), path);
    sendSuccess(res, file);
  },
};
