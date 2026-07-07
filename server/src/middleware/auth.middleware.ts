import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../common/errors/AppError.ts";
import { userService } from "../modules/user/user.service.ts";

export async function requireAuthenticatedUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) {
      throw new UnauthorizedError("Authentication required");
    }

    req.dbUser = await userService.getOrCreateByClerkId(clerkId);
    next();
  } catch (err) {
    next(err);
  }
}
