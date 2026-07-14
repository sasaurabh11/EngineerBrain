import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "../auth/context.ts";
import { backendRequest } from "../clients/backendClient.ts";
import { withToolErrorHandling } from "../middleware/errorMapper.ts";
import type { AgentExecutionResponseDto, TaskResponseDto, WorkflowDescriptor } from "../types/backend.types.ts";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 90_000;

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeTask(task: TaskResponseDto): string {
  const header = `Task ${task.id} - ${task.status}${task.workflowKey ? ` (${task.workflowKey})` : ""} - ${task.goal}`;

  if (task.status === "COMPLETED") {
    return `${header}\n\n${task.resultSummary ?? "(no result summary)"}`;
  }
  if (task.status === "FAILED") {
    return `${header}\n\nError: ${task.errorMessage ?? "unknown error"}`;
  }
  if (task.status === "PENDING_APPROVAL") {
    return `${header}\n\nThis task wants to run a write action (step: ${task.pendingStepId}) and is paused waiting for a human with OWNER/ADMIN access to approve it from the EngineerBrain web app. It cannot be approved through this tool.`;
  }
  return `${header}\n\nStill in progress (${task.progress}%). Check back with get_task_status({ taskId: "${task.id}" }).`;
}

export function registerWorkflowTools(server: McpServer, auth: AuthContext): void {
  server.registerTool(
    "list_available_workflows",
    {
      title: "List available engineering workflows",
      description: "Lists the pre-built multi-step agent workflows this platform can run (e.g. pull request review, issue triage), with the parameters each one requires. Call this before run_engineering_workflow if you're not sure which workflowKey or params to use.",
      inputSchema: {},
    },
    withToolErrorHandling("list_available_workflows", async () => {
      const workflows = await backendRequest<WorkflowDescriptor[]>(`/organizations/${auth.organizationSlug}/tasks/workflows`, {
        bearerToken: auth.bearerToken,
      });

      const text = workflows
        .map((w) => `${w.key} - ${w.name}: ${w.description}${w.params.length > 0 ? `\n  params: ${w.params.map((p) => `${p.key} (${p.type}${p.required ? ", required" : ""})`).join(", ")}` : ""}`)
        .join("\n\n");

      return { content: [{ type: "text", text: text || "No workflows available." }] };
    }),
  );

  server.registerTool(
    "run_engineering_workflow",
    {
      title: "Run an engineering agent workflow",
      description:
        "Starts one of this platform's multi-step agent workflows (see list_available_workflows for valid keys and params) against a repository, and waits up to 90 seconds for it to finish. " +
        "Workflows that need to write back to GitHub (posting a review comment or check run) pause for human approval and won't complete through this tool alone - you'll get the task ID to check on later.",
      inputSchema: {
        workflowKey: z.string().describe('Workflow key from list_available_workflows, e.g. "pr-review", "issue-triage", "architecture-review", "onboarding-guide"'),
        repositoryId: z.string().describe("Repository UUID this workflow should run against"),
        goal: z.string().describe("A short human-readable description of what this run is for, e.g. \"Review PR #42\""),
        prNumber: z.number().int().optional().describe('Required by the "pr-review" workflow'),
        issueNumber: z.number().int().optional().describe('Required by the "issue-triage" workflow'),
      },
    },
    withToolErrorHandling(
      "run_engineering_workflow",
      async ({
        workflowKey,
        repositoryId,
        goal,
        prNumber,
        issueNumber,
      }: {
        workflowKey: string;
        repositoryId: string;
        goal: string;
        prNumber?: number;
        issueNumber?: number;
      }) => {
        const workflowParams: Record<string, number> = {};
        if (prNumber !== undefined) workflowParams.prNumber = prNumber;
        if (issueNumber !== undefined) workflowParams.issueNumber = issueNumber;

        let task = await backendRequest<TaskResponseDto>(`/organizations/${auth.organizationSlug}/tasks`, {
          method: "POST",
          bearerToken: auth.bearerToken,
          body: { goal, repositoryId, workflowKey, workflowParams },
        });

        const deadline = Date.now() + POLL_TIMEOUT_MS;
        while (!TERMINAL_STATUSES.has(task.status) && task.status !== "PENDING_APPROVAL" && Date.now() < deadline) {
          await sleep(POLL_INTERVAL_MS);
          task = await backendRequest<TaskResponseDto>(`/organizations/${auth.organizationSlug}/tasks/${task.id}`, {
            bearerToken: auth.bearerToken,
          });
        }

        return { content: [{ type: "text", text: describeTask(task) }] };
      },
    ),
  );

  server.registerTool(
    "get_task_status",
    {
      title: "Get engineering task status",
      description: "Checks the status and result of a task started by run_engineering_workflow, including its step-by-step execution log.",
      inputSchema: { taskId: z.string().describe("Task ID returned by run_engineering_workflow") },
    },
    withToolErrorHandling("get_task_status", async ({ taskId }: { taskId: string }) => {
      const base = `/organizations/${auth.organizationSlug}/tasks/${taskId}`;
      const [task, executions] = await Promise.all([
        backendRequest<TaskResponseDto>(base, { bearerToken: auth.bearerToken }),
        backendRequest<AgentExecutionResponseDto[]>(`${base}/executions`, { bearerToken: auth.bearerToken }),
      ]);

      const steps = executions.map((e) => `  ${e.stepIndex + 1}. ${e.agentKey} - ${e.status}`).join("\n");
      const text = `${describeTask(task)}${steps ? `\n\nSteps:\n${steps}` : ""}`;

      return { content: [{ type: "text", text }] };
    }),
  );
}
