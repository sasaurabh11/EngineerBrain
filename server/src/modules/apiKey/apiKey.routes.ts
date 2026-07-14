import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { apiKeyController } from "./apiKey.controller.ts";
import { createApiKeySchema } from "./apiKey.validation.ts";

export const apiKeyRouter = Router();

const base = "/organizations/:orgSlug/api-keys";

apiKeyRouter.get(base, requireAuthenticatedUser, requireOrgRole(["OWNER", "ADMIN"]), apiKeyController.list);

apiKeyRouter.post(
  base,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  validate(createApiKeySchema),
  apiKeyController.create,
);

apiKeyRouter.delete(
  `${base}/:apiKeyId`,
  requireAuthenticatedUser,
  requireOrgRole(["OWNER", "ADMIN"]),
  apiKeyController.revoke,
);
