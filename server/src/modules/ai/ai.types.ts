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
  // Replaces the streamed-so-far text wholesale - only emitted on the rare
  // path where the Critic finds the streamed answer ungrounded and the
  // Synthesizer has to regenerate it; the client swaps its buffer instead of
  // appending, so a grounding fix never renders as duplicated/garbled text.
  | { type: "replace"; text: string }
  | { type: "done"; messageId: string; citations: CitationCandidate[] }
  | { type: "error"; message: string; code?: string };
