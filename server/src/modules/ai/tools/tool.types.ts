export interface ToolContext {
  organizationId: string;
  userId: string;
  repositoryId?: string;
}

export interface AiTool<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: TArgs, ctx: ToolContext): Promise<TResult>;
}
