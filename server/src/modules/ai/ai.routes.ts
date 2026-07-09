import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { aiController } from "./ai.controller.ts";
import { createConversationSchema, sendMessageSchema } from "./ai.validation.ts";

export const aiRouter = Router();

const base = "/organizations/:orgSlug/ai";

aiRouter.post(
  `${base}/conversations`,
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(createConversationSchema),
  aiController.createConversation,
);

aiRouter.get(`${base}/conversations`, requireAuthenticatedUser, requireOrgRole(), aiController.listConversations);

aiRouter.get(`${base}/conversations/:id`, requireAuthenticatedUser, requireOrgRole(), aiController.getConversation);

aiRouter.delete(`${base}/conversations/:id`, requireAuthenticatedUser, requireOrgRole(), aiController.deleteConversation);

aiRouter.post(
  `${base}/conversations/:id/messages`,
  requireAuthenticatedUser,
  requireOrgRole(),
  validate(sendMessageSchema),
  aiController.sendMessage,
);

aiRouter.get(`${base}/tools`, requireAuthenticatedUser, requireOrgRole(), aiController.listTools);
