import { Router } from "express";
import { sendSuccess } from "../common/response/formatResponse.ts";
import { githubRouter } from "../modules/github/github.routes.ts";
import { invitationRouter } from "../modules/invitation/invitation.routes.ts";
import { memberRouter } from "../modules/member/member.routes.ts";
import { organizationRouter } from "../modules/organization/organization.routes.ts";
import { repoRouter } from "../modules/repo/repo.routes.ts";
import { userRouter } from "../modules/user/user.routes.ts";
import { webhookRouter } from "../modules/webhook/webhook.routes.ts";

export const router = Router();

router.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok", timestamp: new Date().toISOString() });
});

router.use(userRouter);
router.use(organizationRouter);
router.use(memberRouter);
router.use(invitationRouter);
router.use(githubRouter);
router.use(repoRouter);
router.use(webhookRouter);
