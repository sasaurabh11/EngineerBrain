import { CheckCircle2, ChevronDown, ListTodo, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { MarkdownContent } from "@/components/markdown-content";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { ToolResultView } from "./components/ToolResultView";
import {
  useApproveTask,
  useCancelTask,
  useRejectTask,
  useRetryTask,
  useTask,
  useTaskExecutions,
} from "../../hooks/useTasks";
import type { AgentExecution, ExecutionStatus, TaskStatus } from "../../types/task.types";

const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
  QUEUED: "neutral",
  RUNNING: "info",
  PENDING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

const EXECUTION_STATUS_TONE: Record<ExecutionStatus, StatusTone> = {
  PENDING: "neutral",
  RUNNING: "info",
  COMPLETED: "success",
  FAILED: "danger",
  SKIPPED: "neutral",
};

function ToolInvocationRow({ toolInvocation }: { toolInvocation: AgentExecution["toolInvocations"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = toolInvocation.result != null;

  return (
    <li className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => hasResult && setExpanded((v) => !v)}
        disabled={!hasResult}
        className="flex w-full items-center justify-between gap-2 p-2 text-left disabled:cursor-default"
      >
        <span className="flex items-center gap-2 font-mono text-xs text-foreground">
          {toolInvocation.toolName}
          <span className="font-sans text-muted-foreground">
            {toolInvocation.status.toLowerCase()} ({toolInvocation.durationMs}ms)
          </span>
        </span>
        {hasResult && (
          <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        )}
      </button>
      {expanded && hasResult && (
        <div className="border-t border-border p-2.5">
          <ToolResultView toolName={toolInvocation.toolName} result={toolInvocation.result} />
        </div>
      )}
    </li>
  );
}

function ExecutionCard({ execution, index, isLast }: { execution: AgentExecution; index: number; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="relative flex gap-4 pb-6">
      {!isLast && <span className="absolute top-6 left-[13px] h-full w-px bg-border" aria-hidden="true" />}
      <span
        className={cn(
          "z-10 mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-full border text-xs font-medium",
          execution.status === "COMPLETED" && "border-success/30 bg-success/10 text-success",
          execution.status === "FAILED" && "border-destructive/30 bg-destructive/10 text-destructive",
          execution.status === "RUNNING" && "border-info/30 bg-info/10 text-info",
          (execution.status === "PENDING" || execution.status === "SKIPPED") && "border-border bg-muted text-muted-foreground",
        )}
      >
        {execution.status === "COMPLETED" && <CheckCircle2 className="size-3.5" />}
        {execution.status === "FAILED" && <XCircle className="size-3.5" />}
        {execution.status === "RUNNING" && <Loader2 className="size-3.5 animate-spin" />}
        {(execution.status === "PENDING" || execution.status === "SKIPPED") && index + 1}
      </span>

      <div className="min-w-0 flex-1 rounded-lg border border-border bg-card">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
          <div className="flex items-center gap-2">
            <StatusBadge tone={EXECUTION_STATUS_TONE[execution.status]}>{execution.status.toLowerCase()}</StatusBadge>
            <span className="font-mono text-sm text-foreground">{execution.agentKey}</span>
          </div>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </button>

        {expanded && (
          <div className="space-y-3 border-t border-border p-3 text-sm">
            {execution.output != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Output</p>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2.5 font-mono text-xs whitespace-pre-wrap text-foreground">
                  {typeof execution.output === "string" ? execution.output : JSON.stringify(execution.output, null, 2)}
                </pre>
              </div>
            )}
            {execution.toolInvocations.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Tool calls</p>
                <ul className="space-y-1.5">
                  {execution.toolInvocations.map((t) => (
                    <ToolInvocationRow key={t.id} toolInvocation={t} />
                  ))}
                </ul>
              </div>
            )}
            {execution.validations.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Validation</p>
                {execution.validations.map((v) => (
                  <p key={v.id} className={cn("text-xs", v.passed ? "text-success" : "text-destructive")}>
                    {v.passed ? "Passed" : "Failed"} (confidence {v.confidence}%){v.issues.length > 0 && ` — ${v.issues.join("; ")}`}
                  </p>
                ))}
              </div>
            )}
            {execution.logs.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Logs</p>
                <ul className="space-y-0.5">
                  {execution.logs.map((l) => (
                    <li key={l.id} className="font-mono text-xs text-muted-foreground">
                      [{l.level}] {l.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function TaskDetailPage() {
  const { orgSlug = "", taskId = "" } = useParams();
  const { data: task, isError, refetch } = useTask(orgSlug, taskId);
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

  if (isError) {
    return <ErrorState title="Failed to load task" message="Something went wrong fetching this task." onRetry={() => refetch()} />;
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading task…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={TASK_STATUS_TONE[task.status]}>{task.status.replace("_", " ").toLowerCase()}</StatusBadge>
            {task.workflowKey && <span className="text-xs text-muted-foreground">{task.workflowKey}</span>}
          </div>
          <h1 className="mt-1.5 text-lg font-semibold text-foreground">{task.goal}</h1>
          <p className="text-xs text-muted-foreground">Created {new Date(task.createdAt).toLocaleString()}</p>
        </div>

        <div className="flex gap-2">
          {task.status === "PENDING_APPROVAL" && (
            <>
              <Button type="button" onClick={() => runAction(() => approveTask.mutateAsync(task.id))} disabled={approveTask.isPending}>
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => runAction(() => rejectTask.mutateAsync(task.id))}
                disabled={rejectTask.isPending}
              >
                Reject
              </Button>
            </>
          )}
          {(task.status === "QUEUED" || task.status === "RUNNING") && (
            <Button type="button" variant="outline" onClick={() => runAction(() => cancelTask.mutateAsync(task.id))} disabled={cancelTask.isPending}>
              Cancel
            </Button>
          )}
          {task.status === "FAILED" && (
            <Button type="button" variant="outline" onClick={() => runAction(() => retryTask.mutateAsync(task.id))} disabled={retryTask.isPending}>
              Retry
            </Button>
          )}
        </div>
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {task.status === "RUNNING" && <Progress value={task.progress} />}

      {task.status === "PENDING_APPROVAL" && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          This task wants to run a write action ({task.pendingStepId}) and is waiting for your approval before proceeding.
        </div>
      )}

      {task.status === "FAILED" && task.errorMessage && <ErrorState title="Task failed" message={task.errorMessage} />}

      {task.status === "COMPLETED" && task.resultSummary && (
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-foreground">Result</p>
            <MarkdownContent content={task.resultSummary} className="mt-2" />
          </CardContent>
        </Card>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-foreground">Execution timeline</p>
        {executions?.length === 0 && <EmptyState icon={ListTodo} title="No steps have run yet" />}
        {executions && executions.length > 0 && (
          <ul>
            {executions.map((execution, i) => (
              <ExecutionCard key={execution.id} execution={execution} index={i} isLast={i === executions.length - 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
