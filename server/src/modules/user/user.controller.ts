import type { Request, Response } from "express";
import { userService } from "./user.service.ts";
import { sendSuccess } from "../../common/response/formatResponse.ts";

export const userController = {
  async getMe(req: Request, res: Response) {
    const response = await userService.toResponseWithApiKeyOrganization(req.dbUser!, req.apiKeyOrganizationId);
    sendSuccess(res, response);
  },

  async updateMe(req: Request, res: Response) {
    const updated = await userService.updateName(req.dbUser!.id, req.body.name);
    sendSuccess(res, userService.toResponse(updated));
  },

  async updateAiSettings(req: Request, res: Response) {
    const updated = await userService.updateAiSettings(req.dbUser!.id, req.body);
    sendSuccess(res, userService.toResponse(updated));
  },
};
