import type { Request, Response } from "express";
import { userService } from "./user.service.ts";
import { sendSuccess } from "../../common/response/formatResponse.ts";

export const userController = {
  getMe(req: Request, res: Response) {
    sendSuccess(res, userService.toResponse(req.dbUser!));
  },

  async updateMe(req: Request, res: Response) {
    const updated = await userService.updateName(req.dbUser!.id, req.body.name);
    sendSuccess(res, userService.toResponse(updated));
  },
};
