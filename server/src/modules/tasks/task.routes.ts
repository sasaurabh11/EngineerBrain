import { Router } from "express";
import { requireAuthenticatedUser } from "../../middleware/auth.middleware.ts";
import { requireOrgRole } from "../../middleware/rbac.middleware.ts";
import { validate } from "../../middleware/validate.middleware.ts";
import { taskController } from "./task.controller.ts";
import { createTaskSchema, listTasksQuerySchema } from "./task.validation.ts";

export const taskRouter = Router();

const base = "/organizations/:orgSlug/tasks";

taskRouter.get(`${base}/workflows`, requireAuthenticatedUser, requireOrgRole(), taskController.listWorkflows);

taskRouter.post(base, requireAuthenticatedUser, requireOrgRole(["OWNER", "ADMIN"]), validate(createTaskSchema), taskController.create);

taskRouter.get(base, requireAuthenticatedUser, requireOrgRole(), validate(listTasksQuerySchema), taskController.list);

taskRouter.get(`${base}/:taskId`, requireAuthenticatedUser, requireOrgRole(), taskController.get);

taskRouter.get(`${base}/:taskId/executions`, requireAuthenticatedUser, requireOrgRole(), taskController.executions);

taskRouter.post(`${base}/:taskId/retry`, requireAuthenticatedUser, requireOrgRole(["OWNER", "ADMIN"]), taskController.retry);

taskRouter.post(`${base}/:taskId/cancel`, requireAuthenticatedUser, requireOrgRole(["OWNER", "ADMIN"]), taskController.cancel);

taskRouter.post(`${base}/:taskId/approve`, requireAuthenticatedUser, requireOrgRole(["OWNER", "ADMIN"]), taskController.approve);

taskRouter.post(`${base}/:taskId/reject`, requireAuthenticatedUser, requireOrgRole(["OWNER", "ADMIN"]), taskController.reject);
