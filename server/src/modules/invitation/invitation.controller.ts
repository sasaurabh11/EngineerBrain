import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { invitationService } from "./invitation.service.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

export const invitationController = {
  async list(req: Request, res: Response) {
    const invitations = await invitationService.listByOrg(req.organization!.id);
    sendSuccess(res, invitations);
  },

  async create(req: Request, res: Response) {
    const invitation = await invitationService.create(
      req.organization!.id,
      req.dbUser!.id,
      req.membership!.role,
      req.body,
    );
    sendSuccess(res, invitation, 201);
  },

  async revoke(req: Request, res: Response) {
    await invitationService.revoke(req.organization!.id, getParam(req, "invitationId"));
    sendSuccess(res, { revoked: true });
  },

  async accept(req: Request, res: Response) {
    const organizationId = await invitationService.accept(getParam(req, "token"), {
      id: req.dbUser!.id,
      email: req.dbUser!.email,
    });
    sendSuccess(res, { organizationId });
  },
};
