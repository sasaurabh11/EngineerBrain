import { z } from "zod";

const STATUSES = ["QUEUED", "RUNNING", "PENDING_APPROVAL", "COMPLETED", "FAILED", "CANCELLED"] as const;

export const createTaskSchema = {
  body: z.object({
    goal: z.string().min(1).max(2000),
    repositoryId: z.string().uuid().optional(),
    workflowKey: z.string().optional(),
    workflowParams: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
};

export const listTasksQuerySchema = {
  query: z.object({
    status: z.enum(STATUSES).optional(),
    repositoryId: z.string().uuid().optional(),
    workflowKey: z.string().optional(),
    prNumber: z.coerce.number().int().optional(),
    issueNumber: z.coerce.number().int().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
};
