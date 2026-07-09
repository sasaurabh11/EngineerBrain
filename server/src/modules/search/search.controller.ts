import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { searchService } from "./search.service.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

function getQueryString(req: Request, name: string): string {
  const value = req.query[name];
  return typeof value === "string" ? value : "";
}

export const searchController = {
  async searchRepository(req: Request, res: Response) {
    const results = await searchService.searchRepository(
      req.organization!.id,
      getParam(req, "repositoryId"),
      getQueryString(req, "q"),
    );
    sendSuccess(res, results);
  },

  async searchOrganization(req: Request, res: Response) {
    const results = await searchService.searchOrganization(req.organization!.id, getQueryString(req, "q"));
    sendSuccess(res, results);
  },
};
