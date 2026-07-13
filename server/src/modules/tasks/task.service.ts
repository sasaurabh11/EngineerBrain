import { ConflictError, NotFoundError } from "../../common/errors/AppError.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { publishToQueue } from "../../infra/rabbitmq/publisher.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { taskRepository } from "./task.repository.ts";
import type { AgentExecutionResponseDto, TaskJobPayload, TaskResponseDto } from "./task.types.ts";
import { workflowRegistry } from "./workflows/registry.ts";

function toTaskDto(task: {
  id: string;
  organizationId: string;
  repositoryId: string | null;
  createdById: string;
  workflowKey: string | null;
  workflowParams: unknown;
  goal: string;
  status: TaskResponseDto["status"];
  progress: number;
  resultSummary: string | null;
  errorMessage: string | null;
  retryCount: number;
  pendingStepId: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): TaskResponseDto {
  return { ...task, workflowParams: (task.workflowParams as Record<string, unknown> | null) ?? null };
}

export const taskService = {
  async enqueueTask(
    organizationId: string,
    createdById: string,
    goal: string,
    repositoryId?: string,
    workflowKey?: string,
    workflowParams?: Record<string, unknown>,
  ): Promise<TaskResponseDto> {
    if (repositoryId) {
      const repo = await repoRepository.findByOrgAndId(organizationId, repositoryId);
      if (!repo) {
        throw new NotFoundError("Repository not found");
      }
    }

    if (workflowKey) {
      const workflow = workflowRegistry.get(workflowKey);
      if (!workflow) {
        throw new NotFoundError(`Unknown workflow: ${workflowKey}`);
      }
      for (const param of workflow.params) {
        if (param.required && (workflowParams?.[param.key] === undefined || workflowParams?.[param.key] === "")) {
          throw new ConflictError(`Workflow "${workflow.name}" requires a "${param.label}" parameter`);
        }
      }
    }

    const activeCount = await taskRepository.countActiveStatuses(organizationId);
    if (activeCount > 0) {
      throw new ConflictError("This organization already has a task in progress");
    }

    const task = await taskRepository.create(
      organizationId,
      repositoryId ?? null,
      createdById,
      workflowKey ?? null,
      goal,
      workflowParams ?? null,
    );
    const payload: TaskJobPayload = { taskId: task.id };
    await publishToQueue(QUEUES.TASK_EXECUTE, payload);
    return toTaskDto(task);
  },

  async retryTask(organizationId: string, taskId: string): Promise<void> {
    const task = await taskRepository.findById(taskId);
    if (!task || task.organizationId !== organizationId) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }
    if (task.status !== "FAILED") {
      throw new ConflictError("Only a failed task can be retried");
    }

    await taskRepository.markRetryRequested(taskId);
    const payload: TaskJobPayload = { taskId };
    await publishToQueue(QUEUES.TASK_EXECUTE, payload);
  },

  async cancelTask(organizationId: string, taskId: string): Promise<void> {
    const task = await taskRepository.findById(taskId);
    if (!task || task.organizationId !== organizationId) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }
    if (!["QUEUED", "RUNNING", "PENDING_APPROVAL"].includes(task.status)) {
      throw new ConflictError("Only a queued, running, or pending-approval task can be cancelled");
    }

    await taskRepository.markCancelled(taskId);
  },

  async approveTask(organizationId: string, taskId: string, approvedById: string): Promise<void> {
    const task = await taskRepository.findById(taskId);
    if (!task || task.organizationId !== organizationId) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }
    if (task.status !== "PENDING_APPROVAL") {
      throw new ConflictError("This task has no pending write-tool step awaiting approval");
    }

    await taskRepository.markApproved(taskId, approvedById);
    const payload: TaskJobPayload = { taskId };
    await publishToQueue(QUEUES.TASK_EXECUTE, payload);
  },

  async rejectTask(organizationId: string, taskId: string): Promise<void> {
    const task = await taskRepository.findById(taskId);
    if (!task || task.organizationId !== organizationId) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }
    if (task.status !== "PENDING_APPROVAL") {
      throw new ConflictError("This task has no pending write-tool step awaiting approval");
    }

    await taskRepository.markCancelled(taskId);
  },

  async getTask(organizationId: string, taskId: string): Promise<TaskResponseDto> {
    const task = await taskRepository.findById(taskId);
    if (!task || task.organizationId !== organizationId) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }
    return toTaskDto(task);
  },

  async listTasks(
    organizationId: string,
    filters: { status?: string; page: number; pageSize: number },
  ): Promise<{ items: TaskResponseDto[]; totalCount: number }> {
    const { items, totalCount } = await taskRepository.list(organizationId, filters);
    return { items: items.map(toTaskDto), totalCount };
  },

  async getExecutions(organizationId: string, taskId: string): Promise<AgentExecutionResponseDto[]> {
    const task = await taskRepository.findById(taskId);
    if (!task || task.organizationId !== organizationId) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }
    const executions = await taskRepository.listExecutions(taskId);
    return executions;
  },

  listWorkflows() {
    return workflowRegistry.all().map((w) => ({ key: w.key, name: w.name, description: w.description, params: w.params }));
  },
};
