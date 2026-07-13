import type { Request, Response } from "express";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { taskService } from "./task.service.ts";
import { listTasksQuerySchema } from "./task.validation.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

export const taskController = {
  async create(req: Request, res: Response) {
    const task = await taskService.enqueueTask(
      req.organization!.id,
      req.dbUser!.id,
      req.body.goal,
      req.body.repositoryId,
      req.body.workflowKey,
      req.body.workflowParams,
    );
    sendSuccess(res, task, 202);
  },

  async list(req: Request, res: Response) {
    const query = listTasksQuerySchema.query.parse(req.query);
    const { items, totalCount } = await taskService.listTasks(req.organization!.id, query);
    sendSuccess(res, { items, pageInfo: { page: query.page, pageSize: query.pageSize, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)) } });
  },

  async get(req: Request, res: Response) {
    const task = await taskService.getTask(req.organization!.id, getParam(req, "taskId"));
    sendSuccess(res, task);
  },

  async executions(req: Request, res: Response) {
    const executions = await taskService.getExecutions(req.organization!.id, getParam(req, "taskId"));
    sendSuccess(res, executions);
  },

  async retry(req: Request, res: Response) {
    await taskService.retryTask(req.organization!.id, getParam(req, "taskId"));
    sendSuccess(res, { retried: true }, 202);
  },

  async cancel(req: Request, res: Response) {
    await taskService.cancelTask(req.organization!.id, getParam(req, "taskId"));
    sendSuccess(res, { cancelled: true });
  },

  async approve(req: Request, res: Response) {
    await taskService.approveTask(req.organization!.id, getParam(req, "taskId"), req.dbUser!.id);
    sendSuccess(res, { approved: true }, 202);
  },

  async reject(req: Request, res: Response) {
    await taskService.rejectTask(req.organization!.id, getParam(req, "taskId"));
    sendSuccess(res, { rejected: true });
  },

  listWorkflows(_req: Request, res: Response) {
    sendSuccess(res, taskService.listWorkflows());
  },
};
