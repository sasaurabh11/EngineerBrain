import { env } from "../config/env.ts";
import type { AiStreamEvent } from "../types/backend.types.ts";

/** The chat-message endpoint is raw SSE (see server/ai.controller.ts#sendMessage),
 * not the {success,data} JSON envelope every other endpoint uses - this is the
 * one place in the client layer that needs its own parser. Mirrors the same
 * buffer/split-on-blank-line approach the web client uses for the same stream. */
export async function* streamChatMessage(
  organizationSlug: string,
  conversationId: string,
  message: string,
  bearerToken: string,
): AsyncGenerator<AiStreamEvent> {
  const response = await fetch(`${env.ENGINEERBRAIN_API_URL}/organizations/${organizationSlug}/ai/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to send message (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const line = rawEvent.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      yield JSON.parse(line.slice("data: ".length)) as AiStreamEvent;
    }
  }
}
