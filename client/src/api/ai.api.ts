import { apiDelete, apiGet, apiPost, tokenProvider } from "./axiosClient";
import type { AiStreamEvent, Conversation, ConversationDetail, ToolSchema } from "../types/ai.types";

export const aiApi = {
  listConversations: (orgSlug: string) => apiGet<Conversation[]>(`/organizations/${orgSlug}/ai/conversations`),
  getConversation: (orgSlug: string, id: string) =>
    apiGet<ConversationDetail>(`/organizations/${orgSlug}/ai/conversations/${id}`),
  createConversation: (orgSlug: string, repositoryId?: string, title?: string) =>
    apiPost<Conversation>(`/organizations/${orgSlug}/ai/conversations`, { repositoryId, title }),
  deleteConversation: (orgSlug: string, id: string) =>
    apiDelete<{ deleted: boolean }>(`/organizations/${orgSlug}/ai/conversations/${id}`),
  listTools: (orgSlug: string) => apiGet<ToolSchema[]>(`/organizations/${orgSlug}/ai/tools`),
};

/** SSE responses need raw fetch + manual stream parsing - axios/EventSource
 * don't support a POST body with custom auth headers over SSE. */
export async function* streamMessage(
  orgSlug: string,
  conversationId: string,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<AiStreamEvent> {
  const token = await tokenProvider.getToken?.();
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/organizations/${orgSlug}/ai/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
      signal,
    },
  );

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
