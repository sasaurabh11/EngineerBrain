export interface Conversation {
  id: string;
  title: string | null;
  repositoryId: string | null;
  repositoryName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolInvocation {
  toolName: string;
  arguments: unknown;
  result: unknown;
  status: string;
  durationMs: number | null;
}

export interface Citation {
  filePath: string;
  repositoryId: string;
}

export interface Message {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  toolInvocations: ToolInvocation[];
  citations: Citation[];
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: unknown;
}

export type AiStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; name: string; args: Record<string, unknown> }
  | { type: "tool-result"; name: string; status: "SUCCESS" | "FAILED" }
  | { type: "done"; messageId: string; citations: Citation[] }
  | { type: "error"; message: string; code?: string };
