import { Router } from "express";
import { webhookController } from "./webhook.controller.ts";

export const webhookRouter = Router();

// Public: GitHub posts every subscribed event here, authenticated via HMAC
// signature (verified in webhookService.receiveEvent), not our own auth.
webhookRouter.post("/webhooks/github", webhookController.receive);
