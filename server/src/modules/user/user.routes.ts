import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { userController } from "./user.controller.ts";
import { updateMeSchema } from "./user.validation.ts";

export const userRouter = Router();

userRouter.get("/me", requireAuthenticatedUser, userController.getMe);
userRouter.patch("/me", requireAuthenticatedUser, validate(updateMeSchema), userController.updateMe);
