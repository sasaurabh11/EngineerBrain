import { apiGet, apiPost } from "./axiosClient";
import type { AgentExecution, PageInfo, Task, WorkflowDescriptor } from "../types/task.types";

export interface ListTasksFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  repositoryId?: string;
  workflowKey?: string;
  prNumber?: number;
  issueNumber?: number;
}

export const taskApi = {
  listWorkflows: (orgSlug: string) => apiGet<WorkflowDescriptor[]>(`/organizations/${orgSlug}/tasks/workflows`),
  create: (orgSlug: string, goal: string, repositoryId?: string, workflowKey?: string, workflowParams?: Record<string, unknown>) =>
    apiPost<Task>(`/organizations/${orgSlug}/tasks`, { goal, repositoryId, workflowKey, workflowParams }),
  list: (orgSlug: string, filters: ListTasksFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) params.set(key, String(value));
    }
    return apiGet<{ items: Task[]; pageInfo: PageInfo }>(`/organizations/${orgSlug}/tasks?${params.toString()}`);
  },
  get: (orgSlug: string, taskId: string) => apiGet<Task>(`/organizations/${orgSlug}/tasks/${taskId}`),
  executions: (orgSlug: string, taskId: string) =>
    apiGet<AgentExecution[]>(`/organizations/${orgSlug}/tasks/${taskId}/executions`),
  retry: (orgSlug: string, taskId: string) => apiPost<{ retried: boolean }>(`/organizations/${orgSlug}/tasks/${taskId}/retry`),
  cancel: (orgSlug: string, taskId: string) => apiPost<{ cancelled: boolean }>(`/organizations/${orgSlug}/tasks/${taskId}/cancel`),
  approve: (orgSlug: string, taskId: string) => apiPost<{ approved: boolean }>(`/organizations/${orgSlug}/tasks/${taskId}/approve`),
  reject: (orgSlug: string, taskId: string) => apiPost<{ rejected: boolean }>(`/organizations/${orgSlug}/tasks/${taskId}/reject`),
};
