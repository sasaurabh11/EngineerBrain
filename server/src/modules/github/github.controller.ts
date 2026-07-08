import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { env } from "../../config/env.ts";
import { organizationRepository } from "../organization/organization.repository.ts";
import { githubService } from "./github.service.ts";

function getQueryString(req: Request, name: string): string {
  const value = req.query[name];
  return typeof value === "string" ? value : "";
}

export const githubController = {
  async status(req: Request, res: Response) {
    const status = await githubService.getStatus(req.organization!.id);
    sendSuccess(res, status);
  },

  async installUrl(req: Request, res: Response) {
    const url = await githubService.getInstallUrl(req.organization!.id, req.dbUser!.id);
    sendSuccess(res, { url });
  },

  async disconnect(req: Request, res: Response) {
    await githubService.disconnect(req.organization!.id);
    sendSuccess(res, { disconnected: true });
  },

  async callback(req: Request, res: Response) {
    const installationId = Number(getQueryString(req, "installation_id"));
    const state = getQueryString(req, "state");

    try {
      const { organizationId } = await githubService.handleCallback(installationId, state);
      const organization = await organizationRepository.findById(organizationId);
      const slugSegment = organization ? `/app/${organization.slug}/settings?github=connected` : "/organizations";
      res.redirect(`${env.CLIENT_ORIGIN}${slugSegment}`);
    } catch {
      res.redirect(`${env.CLIENT_ORIGIN}/organizations?github=error`);
    }
  },
};
