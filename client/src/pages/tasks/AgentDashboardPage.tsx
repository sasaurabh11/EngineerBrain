import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRepositories } from "../../hooks/useRepositories";
import { useCreateTask, useTaskList, useWorkflows } from "../../hooks/useTasks";
import type { TaskStatus } from "../../types/task.types";

const STATUS_STYLES: Record<TaskStatus, string> = {
  QUEUED: "bg-gray-100 text-gray-600",
  RUNNING: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
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
    setWorkflowKey(key);
    setWorkflowParamValues({});
  }

  async function handleCreate(e: React.FormEvent) {
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
        <h1 className="text-xl font-semibold text-gray-900">AI Task Center</h1>
        <p className="text-sm text-gray-500">Run autonomous multi-step engineering agents against your repositories.</p>
      </div>

      <form onSubmit={handleCreate} className="space-y-3 rounded border border-gray-200 bg-white p-4">
        <div>
          <label className="text-xs font-medium text-gray-700">Goal</label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Review this repository's architecture"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-700">Workflow (optional - leave blank for an ad hoc plan)</label>
            <select
              value={workflowKey}
              onChange={(e) => handleWorkflowChange(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Ad hoc (Planner decides)</option>
              {workflows?.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-700">Repository (optional)</label>
            <select
              value={repositoryId}
              onChange={(e) => setRepositoryId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">None</option>
              {repositories?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedWorkflow && <p className="text-xs text-gray-500">{selectedWorkflow.description}</p>}
        {selectedWorkflow && selectedWorkflow.params.length > 0 && (
          <div className="flex gap-3">
            {selectedWorkflow.params.map((param) => (
              <div key={param.key} className="flex-1">
                <label className="text-xs font-medium text-gray-700">
                  {param.label}
                  {param.required && " *"}
                </label>
                <input
                  type={param.type === "number" ? "number" : "text"}
                  value={workflowParamValues[param.key] ?? ""}
                  onChange={(e) => setWorkflowParamValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
                  required={param.required}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        )}
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={createTask.isPending || !goal}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createTask.isPending ? "Starting..." : "Run task"}
        </button>
      </form>

      <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
        {taskPage?.items.length === 0 && <li className="p-4 text-sm text-gray-500">No tasks yet.</li>}
        {taskPage?.items.map((task) => (
          <li key={task.id} className="p-3">
            <Link to={`/app/${orgSlug}/tasks/${task.id}`} className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status]}`}>{task.status}</span>
                  {task.workflowKey && <span className="text-xs text-gray-400">{task.workflowKey}</span>}
                </div>
                <p className="mt-1 text-sm text-gray-900">{task.goal}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{new Date(task.createdAt).toLocaleString()}</p>
                {task.status === "RUNNING" && <p>{task.progress}%</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
