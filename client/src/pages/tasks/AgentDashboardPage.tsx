import { Bot, CircleCheck, Clock, Loader2, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/metric-card";
import { PageHelp } from "@/components/page-help";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { useRepositories } from "../../hooks/useRepositories";
import { useCreateTask, useTaskList, useTaskStatusCounts, useWorkflows } from "../../hooks/useTasks";
import type { TaskStatus } from "../../types/task.types";

const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
  QUEUED: "neutral",
  RUNNING: "info",
  PENDING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

const STATUS_FILTERS: { label: string; value: TaskStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Running", value: "RUNNING" },
  { label: "Queued", value: "QUEUED" },
  { label: "Needs approval", value: "PENDING_APPROVAL" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
];

export function AgentDashboardPage() {
  const { orgSlug = "" } = useParams();
  const { data: workflows } = useWorkflows(orgSlug);
  const { data: repositories } = useRepositories(orgSlug, {});
  const { data: counts } = useTaskStatusCounts(orgSlug);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const { data: taskPage } = useTaskList(orgSlug, 1, statusFilter || undefined);
  const createTask = useCreateTask(orgSlug);

  const [goal, setGoal] = useState("");
  const [workflowKey, setWorkflowKey] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [workflowParamValues, setWorkflowParamValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const selectedWorkflow = workflows?.find((w) => w.key === workflowKey);

  function handleWorkflowChange(key: string) {
    setWorkflowKey(key === "adhoc" ? "" : key);
    setWorkflowParamValues({});
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const workflowParams: Record<string, unknown> = {};
      for (const param of selectedWorkflow?.params ?? []) {
        const raw = workflowParamValues[param.key];
        if (raw === undefined || raw === "") continue;
        workflowParams[param.key] = param.type === "number" ? Number(raw) : raw;
      }

      await createTask.mutateAsync({
        goal,
        repositoryId: repositoryId || undefined,
        workflowKey: workflowKey || undefined,
        workflowParams: Object.keys(workflowParams).length > 0 ? workflowParams : undefined,
      });
      setGoal("");
      setWorkflowKey("");
      setRepositoryId("");
      setWorkflowParamValues({});
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl font-semibold text-foreground">AI Task Center</h1>
          <PageHelp title="How to run a task">
            <p>
              Type a <strong>Goal</strong> in plain English. Optionally pick a pre-built <strong>Workflow</strong> (e.g. PR review, issue triage) instead
              of letting the planner decide the steps itself, and a <strong>Repository</strong> to scope it to.
            </p>
            <p>
              Click any task to see its full step-by-step execution trace: each agent step, the tools it called, and validation results. Tasks that
              write back to GitHub pause for approval before posting.
            </p>
            <p>Use the status pills above the list to filter, and the tiles above those for a running count by status.</p>
          </PageHelp>
        </div>
        <p className="text-sm text-muted-foreground">Run autonomous multi-step engineering agents against your repositories.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up" style={{ animationDelay: "20ms" }}>
        <MetricCard
          label="Active"
          value={(counts?.RUNNING ?? 0) + (counts?.QUEUED ?? 0) + (counts?.PENDING_APPROVAL ?? 0)}
          icon={Clock}
          tone="info"
          hint="Tasks currently running, queued, or waiting for approval."
        />
        <MetricCard label="Completed" value={counts?.COMPLETED ?? 0} icon={CircleCheck} tone="success" />
        <MetricCard label="Failed" value={counts?.FAILED ?? 0} icon={TriangleAlert} tone={counts && counts.FAILED > 0 ? "danger" : "neutral"} />
        <MetricCard
          label="Total tasks"
          value={Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0)}
          icon={Bot}
          tone="neutral"
        />
      </div>

      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Run a new task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Goal</label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Review this repository's architecture"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Workflow (optional)</label>
                <Select value={workflowKey || "adhoc"} onValueChange={handleWorkflowChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adhoc">Ad hoc (Planner decides)</SelectItem>
                    {workflows?.map((w) => (
                      <SelectItem key={w.key} value={w.key}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Repository (optional)</label>
                <Select value={repositoryId || "none"} onValueChange={(v) => setRepositoryId(v === "none" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {repositories?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedWorkflow && <p className="text-xs text-muted-foreground">{selectedWorkflow.description}</p>}
            {selectedWorkflow && selectedWorkflow.params.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedWorkflow.params.map((param) => (
                  <div key={param.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {param.label}
                      {param.required && " *"}
                    </label>
                    <Input
                      type={param.type === "number" ? "number" : "text"}
                      value={workflowParamValues[param.key] ?? ""}
                      onChange={(e) => setWorkflowParamValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
                      required={param.required}
                    />
                  </div>
                ))}
              </div>
            )}

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <Button type="submit" disabled={createTask.isPending || !goal}>
              {createTask.isPending && <Loader2 className="animate-spin" />}
              Run task
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              statusFilter === f.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {taskPage?.items.length === 0 && (
        <EmptyState
          icon={Bot}
          title={statusFilter ? "No tasks with this status" : "No agent tasks yet"}
          description={
            statusFilter ? "Try a different filter, or clear it to see every task." : "Run a workflow to review a PR, triage an issue, or audit a repository."
          }
        />
      )}

      {taskPage && taskPage.items.length > 0 && (
        <Card className="animate-fade-up py-0" style={{ animationDelay: "80ms" }}>
          <ul className="divide-y divide-border">
            {taskPage.items.map((task) => (
              <li key={task.id} className="group relative">
                <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                <Link to={`/app/${orgSlug}/tasks/${task.id}`} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={TASK_STATUS_TONE[task.status]} pulse={task.status === "RUNNING"}>
                        {task.status.replace("_", " ").toLowerCase()}
                      </StatusBadge>
                      {task.workflowKey && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">{task.workflowKey}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-foreground">{task.goal}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>{new Date(task.createdAt).toLocaleString()}</p>
                    {task.status === "RUNNING" && <p className="tabular-nums">{task.progress}%</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
