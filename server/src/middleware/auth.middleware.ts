import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../common/errors/AppError.ts";
import { API_KEY_PREFIX, apiKeyService } from "../modules/apiKey/apiKey.service.ts";
import { userService } from "../modules/user/user.service.ts";

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

export async function requireAuthenticatedUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearerToken = extractBearerToken(req);

    if (bearerToken?.startsWith(API_KEY_PREFIX)) {
      const { user, organizationId } = await apiKeyService.verify(bearerToken);
      req.dbUser = user;
      req.apiKeyOrganizationId = organizationId;
      return next();
    }

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
