import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskApi } from "../api/task.api";

const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING", "PENDING_APPROVAL"]);

export function useWorkflows(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["tasks", "workflows", orgSlug],
    queryFn: () => taskApi.listWorkflows(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useTaskList(orgSlug: string | undefined, page = 1, status?: string) {
  return useQuery({
    queryKey: ["tasks", "list", orgSlug, page, status],
    queryFn: () => taskApi.list(orgSlug!, { page, pageSize: 20, status }),
    enabled: Boolean(orgSlug),
    refetchInterval: (query) => (query.state.data?.items.some((t) => ACTIVE_STATUSES.has(t.status)) ? 3000 : false),
  });
}

export function useLatestWorkflowTask(
  orgSlug: string | undefined,
  repositoryId: string | undefined,
  workflowKey: string,
  target: { prNumber?: number; issueNumber?: number },
) {
  const { prNumber, issueNumber } = target;
  return useQuery({
    queryKey: ["tasks", "latest", orgSlug, repositoryId, workflowKey, prNumber, issueNumber],
    queryFn: async () => {
      const { items } = await taskApi.list(orgSlug!, { repositoryId, workflowKey, prNumber, issueNumber, page: 1, pageSize: 1 });
      return items[0] ?? null;
    },
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
    refetchInterval: (query) => (query.state.data && ACTIVE_STATUSES.has(query.state.data.status) ? 3000 : false),
  });
}

export function useTask(orgSlug: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", "detail", orgSlug, taskId],
    queryFn: () => taskApi.get(orgSlug!, taskId!),
    enabled: Boolean(orgSlug) && Boolean(taskId),
    refetchInterval: (query) => (query.state.data && ACTIVE_STATUSES.has(query.state.data.status) ? 3000 : false),
  });
}

export function useTaskExecutions(orgSlug: string | undefined, taskId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["tasks", "executions", orgSlug, taskId],
    queryFn: () => taskApi.executions(orgSlug!, taskId!),
    enabled: Boolean(orgSlug) && Boolean(taskId) && enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}

export function useCreateTask(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      goal,
      repositoryId,
      workflowKey,
      workflowParams,
    }: {
      goal: string;
      repositoryId?: string;
      workflowKey?: string;
      workflowParams?: Record<string, unknown>;
    }) => taskApi.create(orgSlug, goal, repositoryId, workflowKey, workflowParams),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", "list", orgSlug] }),
  });
}

function useTaskAction(orgSlug: string, action: (orgSlug: string, taskId: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => action(orgSlug, taskId),
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail", orgSlug, taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "list", orgSlug] });
    },
  });
}

export function useRetryTask(orgSlug: string) {
  return useTaskAction(orgSlug, taskApi.retry);
}

export function useCancelTask(orgSlug: string) {
  return useTaskAction(orgSlug, taskApi.cancel);
}

export function useApproveTask(orgSlug: string) {
  return useTaskAction(orgSlug, taskApi.approve);
}

export function useRejectTask(orgSlug: string) {
  return useTaskAction(orgSlug, taskApi.reject);
}
