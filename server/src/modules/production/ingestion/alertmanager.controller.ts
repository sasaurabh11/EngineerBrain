import type { Request, Response } from "express";
import { sendSuccess } from "../../../common/response/formatResponse.ts";
import { alertmanagerService } from "./alertmanager.service.ts";
import type { AlertmanagerPayload } from "./alertmanager.types.ts";

export const alertmanagerController = {
  async receive(req: Request, res: Response) {
    const integrationId = req.params.integrationId as string;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

    await alertmanagerService.receiveWebhook(integrationId, bearerToken, req.body as AlertmanagerPayload);
    sendSuccess(res, { received: true });
  },
};
