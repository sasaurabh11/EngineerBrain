import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { memberService } from "./member.service.ts";

function getMemberId(req: Request): string {
  return typeof req.params.memberId === "string" ? req.params.memberId : "";
}

export const memberController = {
  async list(req: Request, res: Response) {
    const members = await memberService.listByOrg(req.organization!.id);
    sendSuccess(res, members);
  },

  async updateRole(req: Request, res: Response) {
    const updated = await memberService.updateRole(
      req.organization!.id,
      getMemberId(req),
      req.body.role,
      req.membership!.role,
    );
    sendSuccess(res, updated);
  },

  async remove(req: Request, res: Response) {
    await memberService.remove(req.organization!.id, getMemberId(req), req.membership!.role);
    sendSuccess(res, { deleted: true });
  },
};
