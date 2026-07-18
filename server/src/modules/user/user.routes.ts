import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { userController } from "./user.controller.ts";
import { updateAiSettingsSchema, updateMeSchema } from "./user.validation.ts";

export const userRouter = Router();

userRouter.get("/me", requireAuthenticatedUser, userController.getMe);
userRouter.patch("/me", requireAuthenticatedUser, validate(updateMeSchema), userController.updateMe);
userRouter.patch("/me/ai-settings", requireAuthenticatedUser, validate(updateAiSettingsSchema), userController.updateAiSettings);
