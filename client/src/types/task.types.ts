export type TaskStatus = "QUEUED" | "RUNNING" | "PENDING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ExecutionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

export interface Task {
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
  errorCode: string | null;
  retryCount: number;
  pendingStepId: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ExecutionLog {
  id: string;
  level: string;
  message: string;
  metadata: unknown;
  createdAt: string;
}

export interface ValidationResult {
  id: string;
  passed: boolean;
  issues: string[];
  confidence: number | null;
  createdAt: string;
}

export interface ToolInvocation {
  id: string;
  toolName: string;
  arguments: unknown;
  result: unknown;
  status: string;
  durationMs: number | null;
}

export interface AgentExecution {
  id: string;
  agentKey: string;
  stepIndex: number;
  parentExecutionId: string | null;
  status: ExecutionStatus;
  input: unknown;
  output: unknown;
  tokensUsed: number | null;
  startedAt: string | null;
  completedAt: string | null;
  logs: ExecutionLog[];
  validations: ValidationResult[];
  toolInvocations: ToolInvocation[];
}

export interface WorkflowParamDescriptor {
  key: string;
  label: string;
  type: "number" | "string";
  required: boolean;
}

export interface WorkflowDescriptor {
  key: string;
  name: string;
  description: string;
  params: WorkflowParamDescriptor[];
}

export interface PageInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
