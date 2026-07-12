import { logger } from "../../config/logger.ts";
import { QUEUES } from "../../infra/rabbitmq/connection.ts";
import { consumeQueue } from "../../infra/rabbitmq/consumer.ts";
import { callAgentStep, callPlan, callValidate, type ChatMessagePayload, type PlanStepPayload } from "../ai/agents/agentClient.ts";
import { toolRegistry } from "../ai/tools/registry.ts";
import type { ToolContext } from "../ai/tools/tool.types.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { taskRepository } from "./task.repository.ts";
import type { TaskJobPayload, TaskPlan } from "./task.types.ts";
import { workflowRegistry } from "./workflows/registry.ts";

const MAX_STEP_TOOL_ROUNDS = 4;
const MAX_EVIDENCE_CHARS = 1500;

function truncate(value: unknown): string {
  return JSON.stringify(value).slice(0, MAX_EVIDENCE_CHARS);
}

async function resolvePlan(task: {
  id: string;
  goal: string;
  repositoryId: string | null;
  workflowKey: string | null;
  planJson: unknown;
}): Promise<TaskPlan> {
  if (task.planJson) {
    return task.planJson as TaskPlan;
  }

  if (task.workflowKey) {
    const workflow = workflowRegistry.get(task.workflowKey);
    if (!workflow) {
      throw new Error(`Unknown workflow: ${task.workflowKey}`);
    }
    const plan: TaskPlan = { steps: workflow.buildPlan(), reasoning: `Fixed workflow: ${workflow.name}` };
    await taskRepository.savePlan(task.id, plan);
    return plan;
  }

  const repo = task.repositoryId ? await repoRepository.findById(task.repositoryId) : null;
  const repositoryContext = repo ? `${repo.name}${repo.description ? ` - ${repo.description}` : ""}` : null;
  // The Planner sees write tools too (their descriptions say "requires approval") -
  // the safety boundary is the approval gate at execution time in executeToolStep,
  // not what the Planner is allowed to propose.
  const result = await callPlan(task.goal, repositoryContext, toolRegistry.schemas());
  const plan: TaskPlan = { steps: result.steps, reasoning: result.reasoning };
  await taskRepository.savePlan(task.id, plan);
  return plan;
}

/** Steps whose dependencies are all satisfied, batched by shared parallel_group
 * (steps outside any group run alone). Not a full scheduler - one batch per
 * call, called repeatedly until the plan is exhausted. */
function nextBatch(steps: PlanStepPayload[], doneIds: Set<string>): PlanStepPayload[] {
  const ready = steps.filter((s) => !doneIds.has(s.id) && s.depends_on.every((d) => doneIds.has(d)));
  if (ready.length === 0) {
    return [];
  }
  const group = ready[0]!.parallel_group;
  if (!group) {
    return [ready[0]!];
  }
  return ready.filter((s) => s.parallel_group === group);
}

interface ToolStepResult {
  stepId: string;
  output: unknown;
  approvalPending: boolean;
}

async function executeToolStep(
  taskId: string,
  step: PlanStepPayload,
  stepIndex: number,
  toolCtx: ToolContext,
  existingExecutionId: string | undefined,
): Promise<ToolStepResult> {
  const isWrite = toolRegistry.isWriteTool(step.name);

  if (isWrite && !existingExecutionId) {
    const execution = await taskRepository.createExecution(taskId, step.id, stepIndex, step.input_template);
    await taskRepository.createLog(execution.id, "info", `Write tool "${step.name}" requires approval before executing.`);
    await taskRepository.markPendingApproval(taskId, step.id);
    return { stepId: step.id, output: null, approvalPending: true };
  }

  const execution = existingExecutionId
    ? await taskRepository.markExecutionRunning(existingExecutionId)
    : await taskRepository.markExecutionRunning((await taskRepository.createExecution(taskId, step.id, stepIndex, step.input_template)).id);

  const startedAt = Date.now();
  const tool = toolRegistry.get(step.name);
  if (!tool) {
    const message = `Unknown tool: ${step.name}`;
    await taskRepository.createLog(execution.id, "error", message);
    await taskRepository.completeExecution(execution.id, "FAILED", { error: message });
    throw new Error(message);
  }

  try {
    const result = await tool.execute(step.input_template, toolCtx);
    await taskRepository.createToolInvocation(execution.id, step.name, step.input_template, result, "SUCCESS", Date.now() - startedAt);
    await taskRepository.completeExecution(execution.id, "COMPLETED", result);
    return { stepId: step.id, output: result, approvalPending: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    await taskRepository.createToolInvocation(execution.id, step.name, step.input_template, { error: message }, "FAILED", Date.now() - startedAt);
    await taskRepository.completeExecution(execution.id, "FAILED", { error: message });
    throw new Error(message);
  }
}

interface AgentStepResult {
  finalText: string;
  stepEvidence: string[];
}

async function executeAgentStep(
  taskId: string,
  step: PlanStepPayload,
  stepIndex: number,
  goal: string,
  outputs: Map<string, unknown>,
  toolCtx: ToolContext,
): Promise<AgentStepResult> {
  const execution = await taskRepository.markExecutionRunning((await taskRepository.createExecution(taskId, step.id, stepIndex, step.input_template)).id);

  const priorEvidence = step.depends_on.map((depId) => `${depId}: ${truncate(outputs.get(depId))}`).join("\n") || "(none)";
  let messages: ChatMessagePayload[] = [
    {
      role: "user",
      content: `Overall task goal: ${goal}\n\nYour step: ${step.name}\n\nData gathered from prior steps:\n${priorEvidence}\n\nGather any additional information you need using tools, then stop.`,
    },
  ];

  // Gathering loop: only decides tool calls, never trusted for the final
  // answer text - Gemini's thinking models can hallucinate a tool call even
  // with no tools bound once several rounds of tool-calling history
  // accumulate, so the actual answer always comes from a separate, fresh call below.
  const stepEvidence: string[] = [];
  for (let round = 0; round < MAX_STEP_TOOL_ROUNDS; round++) {
    const result = await callAgentStep("task_step", messages, toolRegistry.readOnlySchemas());
    messages = [...messages, result.message];
    if (result.done) {
      break;
    }

    for (const call of result.message.tool_calls ?? []) {
      const startedAt = Date.now();
      let toolResult: unknown;
      let status: "SUCCESS" | "FAILED" = "SUCCESS";
      try {
        const tool = toolRegistry.get(call.name);
        if (!tool) {
          throw new Error(`Unknown tool: ${call.name}`);
        }
        toolResult = await tool.execute(call.args, toolCtx);
      } catch (err) {
        status = "FAILED";
        toolResult = { error: err instanceof Error ? err.message : "Tool execution failed" };
      }
      await taskRepository.createToolInvocation(execution.id, call.name, call.args, toolResult, status, Date.now() - startedAt);
      stepEvidence.push(`${call.name}(${JSON.stringify(call.args)}) -> ${truncate(toolResult)}`);
      messages = [...messages, { role: "tool", content: JSON.stringify(toolResult), tool_call_id: call.id, name: call.name }];
    }
  }

  const finalPrompt =
    `Overall task goal: ${goal}\n\nYour step: ${step.name}\n\nInformation gathered from prior steps:\n${priorEvidence}\n\n` +
    `Information gathered in this step:\n${stepEvidence.join("\n") || "(none)"}\n\nWrite your final result for this step in plain text.`;
  const finalResult = await callAgentStep("task_step", [{ role: "user", content: finalPrompt }], []);
  const finalText = finalResult.message.content ?? "";

  await taskRepository.createLog(execution.id, "info", `Step "${step.name}" completed.`);
  await taskRepository.completeExecution(execution.id, "COMPLETED", finalText);
  return { finalText, stepEvidence };
}

async function executeValidationStep(
  taskId: string,
  step: PlanStepPayload,
  stepIndex: number,
  goal: string,
  outputText: string,
  evidence: string[],
): Promise<string> {
  const execution = await taskRepository.markExecutionRunning((await taskRepository.createExecution(taskId, step.id, stepIndex, {})).id);
  const verdict = await callValidate(outputText, evidence);
  await taskRepository.createValidation(execution.id, verdict.passed, verdict.issues, verdict.confidence);

  let finalText = outputText;
  if (!verdict.passed) {
    await taskRepository.createLog(execution.id, "warn", `Grounding check failed: ${verdict.issues.join("; ")}. Attempting one revision.`);
    const revisionPrompt =
      `Original goal: ${goal}\n\nInformation gathered:\n${evidence.map((e) => `- ${e}`).join("\n") || "(none)"}\n\n` +
      `Previous result: ${outputText}\n\nThat result had grounding issues: ${verdict.issues.join("; ")}. Write a corrected ` +
      "result using only the gathered information.";
    const revision = await callAgentStep("task_step", [{ role: "user", content: revisionPrompt }], []);
    finalText = revision.message.content ?? outputText;
  }

  await taskRepository.completeExecution(execution.id, "COMPLETED", { verdict, finalText });
  return finalText;
}

export async function performTask(taskId: string): Promise<void> {
  const task = await taskRepository.findById(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  if (task.status === "CANCELLED") {
    return;
  }
  if (task.status === "QUEUED") {
    await taskRepository.markRunning(taskId);
  }

  const plan = await resolvePlan(task);
  const toolCtx: ToolContext = { organizationId: task.organizationId, userId: task.createdById, repositoryId: task.repositoryId ?? undefined };

  const existingExecutions = await taskRepository.listExecutions(taskId);
  const doneIds = new Set(existingExecutions.filter((e) => e.status === "COMPLETED" || e.status === "SKIPPED").map((e) => e.agentKey));
  const outputs = new Map<string, unknown>(existingExecutions.filter((e) => e.status === "COMPLETED").map((e) => [e.agentKey, e.output]));
  const pendingExecutionsByStepId = new Map(existingExecutions.filter((e) => e.status === "PENDING").map((e) => [e.agentKey, e.id]));

  const evidence: string[] = [...outputs.values()].map(truncate);
  let lastAgentOutput = "";

  while (true) {
    const current = await taskRepository.findById(taskId);
    if (!current || current.status === "CANCELLED") {
      return;
    }

    const batch = nextBatch(plan.steps, doneIds);
    if (batch.length === 0) {
      break;
    }

    const allTools = batch.every((s) => s.type === "tool");
    let approvalPendingInBatch = false;

    if (allTools) {
      const results = await Promise.all(
        batch.map((step) =>
          executeToolStep(taskId, step, plan.steps.findIndex((s) => s.id === step.id), toolCtx, pendingExecutionsByStepId.get(step.id)),
        ),
      );
      for (const result of results) {
        if (result.approvalPending) {
          approvalPendingInBatch = true;
          continue;
        }
        outputs.set(result.stepId, result.output);
        evidence.push(truncate(result.output));
        doneIds.add(result.stepId);
      }
    } else {
      for (const step of batch) {
        const stepIndex = plan.steps.findIndex((s) => s.id === step.id);
        if (step.type === "tool") {
          const result = await executeToolStep(taskId, step, stepIndex, toolCtx, pendingExecutionsByStepId.get(step.id));
          if (result.approvalPending) {
            approvalPendingInBatch = true;
            break;
          }
          outputs.set(result.stepId, result.output);
          evidence.push(truncate(result.output));
          doneIds.add(result.stepId);
        } else if (step.type === "agent" || step.type === "decision") {
          const { finalText, stepEvidence } = await executeAgentStep(taskId, step, stepIndex, task.goal, outputs, toolCtx);
          outputs.set(step.id, finalText);
          lastAgentOutput = finalText;
          evidence.push(truncate(finalText), ...stepEvidence);
          doneIds.add(step.id);
        } else if (step.type === "validation") {
          lastAgentOutput = await executeValidationStep(taskId, step, stepIndex, task.goal, lastAgentOutput, evidence);
          doneIds.add(step.id);
        }
      }
    }

    if (approvalPendingInBatch) {
      return;
    }

    await taskRepository.updateProgress(taskId, Math.round((doneIds.size / plan.steps.length) * 100));
  }

  if (doneIds.size < plan.steps.length) {
    throw new Error("Plan execution stalled - one or more steps have unsatisfiable dependencies");
  }

  await taskRepository.complete(taskId, lastAgentOutput.slice(0, 2000));
}

export function startTaskConsumer(): void {
  consumeQueue<TaskJobPayload>(QUEUES.TASK_EXECUTE, async (payload) => {
    try {
      await performTask(payload.taskId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown task execution error";
      const current = await taskRepository.findById(payload.taskId);
      if (current?.status !== "CANCELLED") {
        await taskRepository.markFailed(payload.taskId, message);
      }
      logger.error({ err, taskId: payload.taskId }, "Task execution failed");
      throw err;
    }
  });
}
