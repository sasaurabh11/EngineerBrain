import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useApproveTask,
  useCancelTask,
  useRejectTask,
  useRetryTask,
  useTask,
  useTaskExecutions,
} from "../../hooks/useTasks";
import type { AgentExecution, ExecutionStatus, TaskStatus } from "../../types/task.types";

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  QUEUED: "bg-gray-100 text-gray-600",
  RUNNING: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const EXECUTION_STATUS_STYLES: Record<ExecutionStatus, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  RUNNING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-400",
};

function ExecutionCard({ execution }: { execution: AgentExecution }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="p-3">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${EXECUTION_STATUS_STYLES[execution.status]}`}>
            {execution.status}
          </span>
          <span className="text-sm text-gray-900">{execution.agentKey}</span>
        </div>
        <span className="text-xs text-gray-400">{expanded ? "Hide" : "Details"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm text-gray-700">
          {execution.output != null && (
            <div>
              <p className="font-medium text-gray-900">Output</p>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">
                {typeof execution.output === "string" ? execution.output : JSON.stringify(execution.output, null, 2)}
              </pre>
            </div>
          )}
          {execution.toolInvocations.length > 0 && (
            <div>
              <p className="font-medium text-gray-900">Tool calls</p>
              <ul className="mt-1 space-y-1">
                {execution.toolInvocations.map((t) => (
                  <li key={t.id} className="font-mono text-xs text-gray-500">
                    {t.toolName} - {t.status} ({t.durationMs}ms)
                  </li>
                ))}
              </ul>
            </div>
          )}
          {execution.validations.length > 0 && (
            <div>
              <p className="font-medium text-gray-900">Validation</p>
              {execution.validations.map((v) => (
                <p key={v.id} className={v.passed ? "text-green-700" : "text-red-700"}>
                  {v.passed ? "Passed" : "Failed"} (confidence {v.confidence}%){v.issues.length > 0 && ` - ${v.issues.join("; ")}`}
                </p>
              ))}
            </div>
          )}
          {execution.logs.length > 0 && (
            <div>
              <p className="font-medium text-gray-900">Logs</p>
              <ul className="mt-1 space-y-0.5">
                {execution.logs.map((l) => (
                  <li key={l.id} className="text-xs text-gray-500">
                    [{l.level}] {l.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function TaskDetailPage() {
  const { orgSlug = "", taskId = "" } = useParams();
  const { data: task } = useTask(orgSlug, taskId);
  const isActive = task?.status === "RUNNING" || task?.status === "PENDING_APPROVAL" || task?.status === "QUEUED";
  const { data: executions } = useTaskExecutions(orgSlug, taskId, isActive || task?.status === "COMPLETED" || task?.status === "FAILED");
  const approveTask = useApproveTask(orgSlug);
  const rejectTask = useRejectTask(orgSlug);
  const cancelTask = useCancelTask(orgSlug);
  const retryTask = useRetryTask(orgSlug);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  if (!task) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TASK_STATUS_STYLES[task.status]}`}>{task.status}</span>
            {task.workflowKey && <span className="text-xs text-gray-400">{task.workflowKey}</span>}
          </div>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">{task.goal}</h1>
          <p className="text-xs text-gray-500">Created {new Date(task.createdAt).toLocaleString()}</p>
        </div>

        <div className="flex gap-2">
          {task.status === "PENDING_APPROVAL" && (
            <>
              <button
                type="button"
                onClick={() => runAction(() => approveTask.mutateAsync(task.id))}
                disabled={approveTask.isPending}
                className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => runAction(() => rejectTask.mutateAsync(task.id))}
                disabled={rejectTask.isPending}
                className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {(task.status === "QUEUED" || task.status === "RUNNING") && (
            <button
              type="button"
              onClick={() => runAction(() => cancelTask.mutateAsync(task.id))}
              disabled={cancelTask.isPending}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {task.status === "FAILED" && (
            <button
              type="button"
              onClick={() => runAction(() => retryTask.mutateAsync(task.id))}
              disabled={retryTask.isPending}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      </div>
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {task.status === "RUNNING" && (
        <div className="h-2 w-full overflow-hidden rounded bg-gray-100">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${task.progress}%` }} />
        </div>
      )}

      {task.status === "PENDING_APPROVAL" && (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          This task wants to run a write action ({task.pendingStepId}) and is waiting for your approval before proceeding.
        </div>
      )}

      {task.status === "FAILED" && task.errorMessage && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{task.errorMessage}</div>
      )}

      {task.status === "COMPLETED" && task.resultSummary && (
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Result</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{task.resultSummary}</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-gray-900">Execution timeline</p>
        <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
          {executions?.length === 0 && <li className="p-4 text-sm text-gray-500">No steps have run yet.</li>}
          {executions?.map((execution) => (
            <ExecutionCard key={execution.id} execution={execution} />
          ))}
        </ul>
      </div>
    </div>
  );
}
