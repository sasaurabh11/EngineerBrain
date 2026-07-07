import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { organizationService } from "./organization.service.ts";

export const organizationController = {
  async list(req: Request, res: Response) {
    const organizations = await organizationService.listForUser(req.dbUser!.id);
    sendSuccess(res, organizations);
  },

  async create(req: Request, res: Response) {
    const organization = await organizationService.create(req.dbUser!.id, req.body);
    sendSuccess(res, organization, 201);
  },

  get(req: Request, res: Response) {
    sendSuccess(res, organizationService.toResponse(req.organization!, req.membership!.role));
  },

  async update(req: Request, res: Response) {
    const updated = await organizationService.update(req.organization!.id, req.body);
    sendSuccess(res, organizationService.toResponse(updated, req.membership!.role));
  },

  async remove(req: Request, res: Response) {
    await organizationService.softDelete(req.organization!.id);
    sendSuccess(res, { deleted: true });
  },
};
