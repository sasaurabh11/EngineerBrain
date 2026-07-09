export type LlmPart =
  | { text: string }
  | { functionCall: { id: string; name: string; args: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse: { id: string; name: string; response: Record<string, unknown> } };

export interface LlmMessage {
  role: "user" | "model";
  parts: LlmPart[];
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type LlmStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; id: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface LlmProvider {
  streamChat(params: {
    systemInstruction: string;
    messages: LlmMessage[];
    tools: ToolSchema[];
    signal?: AbortSignal;
  }): AsyncGenerator<LlmStreamEvent>;
}
