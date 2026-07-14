import { Router } from "express";
import { sendSuccess } from "../common/response/formatResponse.ts";
import { aiRouter } from "../modules/ai/ai.routes.ts";
import { analysisRouter } from "../modules/analysis/analysis.routes.ts";
import { apiKeyRouter } from "../modules/apiKey/apiKey.routes.ts";
import { githubRouter } from "../modules/github/github.routes.ts";
import { indexingRouter } from "../modules/indexing/indexing.routes.ts";
import { invitationRouter } from "../modules/invitation/invitation.routes.ts";
import { memberRouter } from "../modules/member/member.routes.ts";
import { organizationRouter } from "../modules/organization/organization.routes.ts";
import { repoRouter } from "../modules/repo/repo.routes.ts";
import { searchRouter } from "../modules/search/search.routes.ts";
import { taskRouter } from "../modules/tasks/task.routes.ts";
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
router.use(apiKeyRouter);
router.use(githubRouter);
router.use(repoRouter);
router.use(webhookRouter);
router.use(indexingRouter);
router.use(searchRouter);
router.use(aiRouter);
router.use(analysisRouter);
router.use(taskRouter);
