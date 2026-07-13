import { Bot, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { useRepositories } from "../../hooks/useRepositories";
import { useCreateTask, useTaskList, useWorkflows } from "../../hooks/useTasks";
import type { TaskStatus } from "../../types/task.types";

const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
  QUEUED: "neutral",
  RUNNING: "info",
  PENDING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export function AgentDashboardPage() {
  const { orgSlug = "" } = useParams();
  const { data: workflows } = useWorkflows(orgSlug);
  const { data: repositories } = useRepositories(orgSlug, {});
  const { data: taskPage } = useTaskList(orgSlug);
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
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI Task Center</h1>
        <p className="text-sm text-muted-foreground">Run autonomous multi-step engineering agents against your repositories.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Run a new task</CardTitle>
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

      {taskPage?.items.length === 0 && (
        <EmptyState icon={Bot} title="No agent tasks yet" description="Run a workflow to review a PR, triage an issue, or audit a repository." />
      )}

      {taskPage && taskPage.items.length > 0 && (
        <Card className="py-0">
          <ul className="divide-y divide-border">
            {taskPage.items.map((task) => (
              <li key={task.id}>
                <Link to={`/app/${orgSlug}/tasks/${task.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={TASK_STATUS_TONE[task.status]}>{task.status.replace("_", " ").toLowerCase()}</StatusBadge>
                      {task.workflowKey && <span className="text-xs text-muted-foreground">{task.workflowKey}</span>}
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
