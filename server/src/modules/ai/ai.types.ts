import type { CitationCandidate } from "./citations.ts";

export interface ConversationResponseDto {
  id: string;
  title: string | null;
  repositoryId: string | null;
  repositoryName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolInvocationResponseDto {
  toolName: string;
  arguments: unknown;
  result: unknown;
  status: string;
  durationMs: number | null;
}

export interface CitationResponseDto {
  filePath: string;
  repositoryId: string;
}

export interface MessageResponseDto {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  toolInvocations: ToolInvocationResponseDto[];
  citations: CitationResponseDto[];
}

export interface ConversationDetailResponseDto extends ConversationResponseDto {
  messages: MessageResponseDto[];
}

export type AiStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; name: string; args: Record<string, unknown> }
  | { type: "tool-result"; name: string; status: "SUCCESS" | "FAILED" }
  | { type: "done"; messageId: string; citations: CitationCandidate[] }
  | { type: "error"; message: string };
