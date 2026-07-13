import { callAiService } from "../../../infra/aiService/aiServiceClient.ts";

export interface ToolCallPayload {
  id: string;
  name: string;
  args: Record<string, unknown>;
  signature?: string | null;
}

export interface ChatMessagePayload {
  role: "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCallPayload[] | null;
  tool_call_id?: string | null;
  name?: string | null;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentStepResult {
  message: ChatMessagePayload;
  done: boolean;
}

export type AgentRole = "retriever" | "synthesizer" | "task_step";

export function callAgentStep(
  role: AgentRole,
  messages: ChatMessagePayload[],
  tools: ToolSpec[] = [],
  systemContext?: string,
  signal?: AbortSignal,
): Promise<AgentStepResult> {
  return callAiService<AgentStepResult>("/internal/agents/agent-step", {
    body: { role, messages, tools, system_context: systemContext ?? null },
    signal,
  });
}

function isEmptyResult(result: AgentStepResult): boolean {
  return !result.message.content && !result.message.tool_calls?.length;
}

/** Gemini occasionally returns a completely empty message (no text, no tool
 * call) for no discernible reason - a known LLM API flakiness, not a logic
 * bug. Used for call sites where an empty result would be silently persisted
 * as a task/chat's actual final answer, which is worse than one retry. */
export async function callAgentStepWithRetry(
  role: AgentRole,
  messages: ChatMessagePayload[],
  tools: ToolSpec[] = [],
  systemContext?: string,
  signal?: AbortSignal,
): Promise<AgentStepResult> {
  const first = await callAgentStep(role, messages, tools, systemContext, signal);
  if (!isEmptyResult(first)) {
    return first;
  }
  return callAgentStep(role, messages, tools, systemContext, signal);
}

export interface PlanStepPayload {
  id: string;
  type: "tool" | "agent" | "decision" | "validation";
  name: string;
  depends_on: string[];
  parallel_group: string | null;
  input_template: Record<string, unknown>;
}

export interface PlanResult {
  steps: PlanStepPayload[];
  reasoning: string;
  revised: boolean;
}

export function callPlan(goal: string, repositoryContext: string | null, availableTools: ToolSpec[]): Promise<PlanResult> {
  return callAiService<PlanResult>("/internal/agents/plan", {
    body: { goal, repository_context: repositoryContext, available_tools: availableTools },
  });
}

export interface ValidateResult {
  passed: boolean;
  confidence: number;
  issues: string[];
}

export function callValidate(output: string, evidence: string[], signal?: AbortSignal): Promise<ValidateResult> {
  return callAiService<ValidateResult>("/internal/agents/validate", { body: { output, evidence }, signal });
}
