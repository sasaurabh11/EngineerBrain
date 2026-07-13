import type { ExecutionStatus, TaskStatus } from "@prisma/client";
import type { PlanStepPayload } from "../ai/agents/agentClient.ts";

export interface TaskJobPayload {
  taskId: string;
}

export interface TaskResponseDto {
  id: string;
  organizationId: string;
  repositoryId: string | null;
  createdById: string;
  workflowKey: string | null;
  workflowParams: Record<string, unknown> | null;
  goal: string;
  status: TaskStatus;
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
}

export interface ExecutionLogResponseDto {
  id: string;
  level: string;
  message: string;
  metadata: unknown;
  createdAt: Date;
}

export interface ValidationResultResponseDto {
  id: string;
  passed: boolean;
  issues: unknown;
  confidence: number | null;
  createdAt: Date;
}

export interface ToolInvocationResponseDto {
  id: string;
  toolName: string;
  arguments: unknown;
  result: unknown;
  status: string;
  durationMs: number | null;
}

export interface AgentExecutionResponseDto {
  id: string;
  agentKey: string;
  stepIndex: number;
  parentExecutionId: string | null;
  status: ExecutionStatus;
  input: unknown;
  output: unknown;
  tokensUsed: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  logs: ExecutionLogResponseDto[];
  validations: ValidationResultResponseDto[];
  toolInvocations: ToolInvocationResponseDto[];
}

export interface TaskPlan {
  steps: PlanStepPayload[];
  reasoning: string;
}
