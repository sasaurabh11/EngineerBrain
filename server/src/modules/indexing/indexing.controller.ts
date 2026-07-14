import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { indexingService } from "./indexing.service.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

function getQueryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" ? value : undefined;
}

export const indexingController = {
  async trigger(req: Request, res: Response) {
    await indexingService.enqueueIndex(getParam(req, "repositoryId"), "MANUAL", req.dbUser!.id, false);
    sendSuccess(res, { triggered: true }, 202);
  },

  async reindex(req: Request, res: Response) {
    await indexingService.enqueueIndex(getParam(req, "repositoryId"), "MANUAL", req.dbUser!.id, true);
    sendSuccess(res, { triggered: true }, 202);
  },

  async status(req: Request, res: Response) {
    const status = await indexingService.getStatus(getParam(req, "repositoryId"));
    sendSuccess(res, status);
  },

  async files(req: Request, res: Response) {
    const files = await indexingService.listFiles(getParam(req, "repositoryId"));
    sendSuccess(res, files);
  },

  async classes(req: Request, res: Response) {
    const symbols = await indexingService.listSymbols(getParam(req, "repositoryId"), ["CLASS", "INTERFACE"]);
    sendSuccess(res, symbols);
  },

  async functions(req: Request, res: Response) {
    const symbols = await indexingService.listSymbols(getParam(req, "repositoryId"), ["FUNCTION", "METHOD"]);
    sendSuccess(res, symbols);
  },

  async graph(req: Request, res: Response) {
    const edges = await indexingService.listGraphEdges(getParam(req, "repositoryId"));
    sendSuccess(res, edges);
  },

  async endpoints(req: Request, res: Response) {
    const endpoints = await indexingService.listApiEndpoints(getParam(req, "repositoryId"));
    sendSuccess(res, endpoints);
  },

  async symbolSource(req: Request, res: Response) {
    const kind = getQueryString(req, "kind") as "class" | "function" | undefined;
    const result = await indexingService.findSymbolSource(
      req.organization!.id,
      getParam(req, "repositoryId"),
      req.dbUser!.id,
      getQueryString(req, "name")!.trim(),
      kind,
    );
    sendSuccess(res, result);
  },
};
