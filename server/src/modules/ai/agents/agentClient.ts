import { callAiService } from "../../../infra/aiService/aiServiceClient.ts";
import type { AiProviderSelection } from "../../../infra/aiService/providerConfig.ts";

function providerBody(providerConfig?: AiProviderSelection): { provider: "gemini" | "groq"; api_key: string | null } {
  return {
    provider: providerConfig ? (providerConfig.provider.toLowerCase() as "gemini" | "groq") : "gemini",
    api_key: providerConfig?.apiKey ?? null,
  };
}

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
  providerConfig?: AiProviderSelection,
): Promise<AgentStepResult> {
  return callAiService<AgentStepResult>("/internal/agents/agent-step", {
    body: { role, messages, tools, system_context: systemContext ?? null, ...providerBody(providerConfig) },
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
  providerConfig?: AiProviderSelection,
): Promise<AgentStepResult> {
  const first = await callAgentStep(role, messages, tools, systemContext, signal, providerConfig);
  if (!isEmptyResult(first)) {
    return first;
  }
  return callAgentStep(role, messages, tools, systemContext, signal, providerConfig);
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

export function callPlan(
  goal: string,
  repositoryContext: string | null,
  availableTools: ToolSpec[],
  providerConfig?: AiProviderSelection,
): Promise<PlanResult> {
  return callAiService<PlanResult>("/internal/agents/plan", {
    body: { goal, repository_context: repositoryContext, available_tools: availableTools, ...providerBody(providerConfig) },
  });
}

export interface ValidateResult {
  passed: boolean;
  confidence: number;
  issues: string[];
}

export function callValidate(
  output: string,
  evidence: string[],
  signal?: AbortSignal,
  providerConfig?: AiProviderSelection,
): Promise<ValidateResult> {
  return callAiService<ValidateResult>("/internal/agents/validate", {
    body: { output, evidence, ...providerBody(providerConfig) },
    signal,
  });
}
