export interface ToolContext {
  organizationId: string;
  userId: string;
  repositoryId?: string;
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
