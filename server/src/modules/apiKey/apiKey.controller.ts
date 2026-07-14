import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { apiKeyService } from "./apiKey.service.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

export const apiKeyController = {
  async list(req: Request, res: Response) {
    const apiKeys = await apiKeyService.list(req.organization!.id);
    sendSuccess(res, apiKeys);
  },

  async create(req: Request, res: Response) {
    const apiKey = await apiKeyService.create(req.organization!.id, req.dbUser!.id, req.body.name);
    sendSuccess(res, apiKey, 201);
  },

  async revoke(req: Request, res: Response) {
    await apiKeyService.revoke(req.organization!.id, getParam(req, "apiKeyId"));
    sendSuccess(res, { revoked: true });
  },
};
