import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { aiApi, streamMessage } from "../api/ai.api";
import type { Citation } from "../types/ai.types";

export function useConversations(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["ai", "conversations", orgSlug],
    queryFn: () => aiApi.listConversations(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useConversation(orgSlug: string | undefined, conversationId: string | undefined) {
  return useQuery({
    queryKey: ["ai", "conversations", orgSlug, conversationId],
    queryFn: () => aiApi.getConversation(orgSlug!, conversationId!),
    enabled: Boolean(orgSlug) && Boolean(conversationId),
  });
}

export function useCreateConversation(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repositoryId, title }: { repositoryId?: string; title?: string }) =>
      aiApi.createConversation(orgSlug, repositoryId, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai", "conversations", orgSlug] }),
  });
}

export function useDeleteConversation(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiApi.deleteConversation(orgSlug, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai", "conversations", orgSlug] }),
  });
}

export function useTools(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["ai", "tools", orgSlug],
    queryFn: () => aiApi.listTools(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

interface ActiveToolCall {
  name: string;
  status: "running" | "SUCCESS" | "FAILED";
}

export function useSendMessage(orgSlug: string, conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTools, setActiveTools] = useState<ActiveToolCall[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (message: string) => {
      if (!conversationId) return;

      setIsStreaming(true);
      setStreamingText("");
      setActiveTools([]);
      setCitations([]);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const event of streamMessage(orgSlug, conversationId, message, controller.signal)) {
          if (event.type === "text-delta") {
            setStreamingText((prev) => prev + event.text);
          } else if (event.type === "tool-call") {
            setActiveTools((prev) => [...prev, { name: event.name, status: "running" }]);
          } else if (event.type === "tool-result") {
            setActiveTools((prev) =>
              prev.map((t) => (t.name === event.name && t.status === "running" ? { ...t, status: event.status } : t)),
            );
          } else if (event.type === "error") {
            setError(event.message);
          } else if (event.type === "done") {
            setCitations(event.citations);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        setIsStreaming(false);
        queryClient.invalidateQueries({ queryKey: ["ai", "conversations", orgSlug, conversationId] });
        queryClient.invalidateQueries({ queryKey: ["ai", "conversations", orgSlug], exact: true });
      }
    },
    [orgSlug, conversationId, queryClient],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, cancel, isStreaming, streamingText, activeTools, citations, error };
}
