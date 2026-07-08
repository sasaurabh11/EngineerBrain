import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { webhookService } from "./webhook.service.ts";

export const webhookController = {
  async receive(req: Request, res: Response) {
    const headers = {
      eventType: req.header("x-github-event") ?? "",
      deliveryId: req.header("x-github-delivery") ?? "",
      signature: req.header("x-hub-signature-256") ?? "",
    };

    await webhookService.receiveEvent(headers, req.rawBody!.toString("utf-8"));
    sendSuccess(res, { received: true });
  },
};
