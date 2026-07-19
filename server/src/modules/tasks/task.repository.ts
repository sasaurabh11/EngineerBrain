import type { ExecutionStatus, Prisma, ToolInvocationStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";
import type { TaskPlan } from "./task.types.ts";

export const taskRepository = {
  create(
    organizationId: string,
    repositoryId: string | null,
    createdById: string,
    workflowKey: string | null,
    goal: string,
    workflowParams: Record<string, unknown> | null = null,
  ) {
    return prisma.task.create({
      data: {
        organizationId,
        repositoryId,
        createdById,
        workflowKey,
        goal,
        status: "QUEUED",
        workflowParams: workflowParams as Prisma.InputJsonValue | undefined,
      },
    });
  },

  savePlan(id: string, plan: TaskPlan) {
    return prisma.task.update({ where: { id }, data: { planJson: plan as unknown as Prisma.InputJsonValue } });
  },

  markRunning(id: string) {
    return prisma.task.update({ where: { id }, data: { status: "RUNNING", startedAt: new Date() } });
  },

  updateProgress(id: string, progress: number) {
    return prisma.task.update({ where: { id }, data: { progress } });
  },

  markPendingApproval(id: string, pendingStepId: string) {
    return prisma.task.update({ where: { id }, data: { status: "PENDING_APPROVAL", pendingStepId } });
  },

  markApproved(id: string, approvedById: string) {
    return prisma.task.update({
      where: { id },
      data: { status: "RUNNING", approvedById, approvedAt: new Date(), pendingStepId: null },
    });
  },

  markCancelled(id: string) {
    return prisma.task.update({ where: { id }, data: { status: "CANCELLED", completedAt: new Date() } });
  },

  markFailed(id: string, errorMessage: string, errorCode?: string) {
    return prisma.task.update({ where: { id }, data: { status: "FAILED", completedAt: new Date(), errorMessage, errorCode } });
  },

  markRetryRequested(id: string) {
    return prisma.task.update({
      where: { id },
      data: { status: "QUEUED", retryCount: { increment: 1 }, errorMessage: null, completedAt: null },
    });
  },

  complete(id: string, resultSummary: string) {
    return prisma.task.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date(), progress: 100, resultSummary } });
  },

  findById(id: string) {
    return prisma.task.findUnique({ where: { id } });
  },

  async list(
    organizationId: string,
    filters: {
      status?: string;
      repositoryId?: string;
      workflowKey?: string;
      prNumber?: number;
      issueNumber?: number;
      page: number;
      pageSize: number;
    },
  ) {
    const where: Prisma.TaskWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.repositoryId ? { repositoryId: filters.repositoryId } : {}),
      ...(filters.workflowKey ? { workflowKey: filters.workflowKey } : {}),
      ...(filters.prNumber !== undefined ? { workflowParams: { path: ["prNumber"], equals: filters.prNumber } } : {}),
      ...(filters.issueNumber !== undefined ? { workflowParams: { path: ["issueNumber"], equals: filters.issueNumber } } : {}),
    };
    const [items, totalCount] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.task.count({ where }),
    ]);
    return { items, totalCount };
  },

  countActiveStatuses(organizationId: string): Promise<number> {
    return prisma.task.count({ where: { organizationId, status: { in: ["QUEUED", "RUNNING", "PENDING_APPROVAL"] } } });
  },

  listExecutions(taskId: string) {
    return prisma.agentExecution.findMany({
      where: { taskId },
      orderBy: { stepIndex: "asc" },
      include: { logs: { orderBy: { createdAt: "asc" } }, validations: true, toolInvocations: true },
    });
  },

  findExecutionByStepId(taskId: string, stepId: string) {
    return prisma.agentExecution.findFirst({ where: { taskId, agentKey: stepId } });
  },

  createExecution(taskId: string, agentKey: string, stepIndex: number, input: unknown) {
    return prisma.agentExecution.create({
      data: { taskId, agentKey, stepIndex, input: input as Prisma.InputJsonValue, status: "PENDING" },
    });
  },

  markExecutionRunning(id: string) {
    return prisma.agentExecution.update({ where: { id }, data: { status: "RUNNING", startedAt: new Date() } });
  },

  completeExecution(id: string, status: ExecutionStatus, output: unknown, tokensUsed?: number) {
    return prisma.agentExecution.update({
      where: { id },
      data: { status, output: output as Prisma.InputJsonValue, tokensUsed, completedAt: new Date() },
    });
  },

  createLog(agentExecutionId: string, level: string, message: string, metadata?: unknown) {
    return prisma.executionLog.create({
      data: { agentExecutionId, level, message, metadata: metadata as Prisma.InputJsonValue | undefined },
    });
  },

  createValidation(agentExecutionId: string, passed: boolean, issues: unknown, confidence?: number) {
    return prisma.validationResult.create({
      data: { agentExecutionId, passed, issues: issues as Prisma.InputJsonValue, confidence },
    });
  },

  createToolInvocation(
    agentExecutionId: string,
    toolName: string,
    args: unknown,
    result: unknown,
    status: ToolInvocationStatus,
    durationMs: number,
  ) {
    return prisma.toolInvocation.create({
      data: {
        agentExecutionId,
        toolName,
        arguments: args as Prisma.InputJsonValue,
        result: result as Prisma.InputJsonValue,
        status,
        durationMs,
      },
    });
  },
};
