import { Router } from "express";
import { alertmanagerController } from "./alertmanager.controller.ts";

export const alertmanagerRouter = Router();

// Public: Alertmanager posts here directly, authenticated via a per-integration
// bearer token (see alertmanager.service.ts::verifyBearerToken), not our own
// session/API-key auth - Alertmanager can't do either of those.
alertmanagerRouter.post("/webhooks/production/alertmanager/:integrationId", alertmanagerController.receive);
