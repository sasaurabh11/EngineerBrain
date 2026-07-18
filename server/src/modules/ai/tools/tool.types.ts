import type { AiProviderSelection } from "../../../infra/aiService/providerConfig.ts";

export interface ToolContext {
  organizationId: string;
  userId: string;
  repositoryId?: string;
  // Some tools (analyze_root_cause, generate_recommendations, generate_postmortem)
  // make their own nested LLM call rather than just returning data to the
  // retriever - they need this to honor the same provider/key as the
  // surrounding conversation. Optional because most tools never touch it;
  // callers outside a live AI conversation (e.g. a plain REST lookup reusing
  // tool helpers) can omit it and those tools fall back to the server default.
  providerConfig?: AiProviderSelection;
}

export interface AiTool<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  // Read tools (the default - omit this field) are safe to call unattended.
  // Write tools mutate state and require human approval before an autonomous
  // task executes them - see task.consumer.ts's approval-gate handling.
  permission?: "read" | "write";
  execute(args: TArgs, ctx: ToolContext): Promise<TResult>;
}
