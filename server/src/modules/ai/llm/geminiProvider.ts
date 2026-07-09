import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { env } from "../../../config/env.ts";
import type { LlmMessage, LlmPart, LlmProvider, LlmStreamEvent } from "./provider.ts";

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

function toGeminiPart(part: LlmPart) {
  if ("text" in part) {
    return { text: part.text };
  }
  if ("functionCall" in part) {
    return {
      functionCall: { id: part.functionCall.id, name: part.functionCall.name, args: part.functionCall.args },
      thoughtSignature: part.thoughtSignature,
    };
  }
  return { functionResponse: { id: part.functionResponse.id, name: part.functionResponse.name, response: part.functionResponse.response } };
}

function toGeminiContents(messages: LlmMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    parts: message.parts.map(toGeminiPart),
  }));
}

export const geminiProvider: LlmProvider = {
  async *streamChat({ systemInstruction, messages, tools, signal }): AsyncGenerator<LlmStreamEvent> {
    if (!env.GEMINI_API_KEY) {
      yield { type: "error", message: "GEMINI_API_KEY is not configured" };
      return;
    }

    try {
      const stream = await client.models.generateContentStream({
        model: env.GEMINI_CHAT_MODEL,
        contents: toGeminiContents(messages),
        config: {
          systemInstruction,
          abortSignal: signal,
          tools: tools.length > 0 ? [{ functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.parameters,
          })) }] : undefined,
        },
      });

      for await (const chunk of stream) {
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];

        for (const part of parts) {
          if (part.text) {
            yield { type: "text-delta", text: part.text };
          }
          if (part.functionCall?.name) {
            yield {
              type: "tool-call",
              id: part.functionCall.id ?? randomUUID(),
              name: part.functionCall.name,
              args: part.functionCall.args ?? {},
              thoughtSignature: part.thoughtSignature,
            };
          }
        }
      }

      yield { type: "done" };
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : "Unknown LLM provider error" };
    }
  },
};
