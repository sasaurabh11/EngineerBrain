import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepositories } from "../../hooks/useRepositories";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useSendMessage,
} from "../../hooks/useAi";
import { MessageBubble } from "./components/MessageBubble";

function ConversationSidebar({ orgSlug, activeId }: { orgSlug: string; activeId: string | undefined }) {
  const { data: conversations } = useConversations(orgSlug);
  const deleteConversation = useDeleteConversation(orgSlug);
  const navigate = useNavigate();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-3">
        <Link
          to={`/app/${orgSlug}/ai`}
          className="block rounded border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + New chat
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {conversations?.length === 0 && <p className="p-2 text-sm text-gray-400">No conversations yet</p>}
        {conversations?.map((c) => (
          <div key={c.id} className={`group flex items-center rounded ${c.id === activeId ? "bg-blue-50" : "hover:bg-gray-50"}`}>
            <Link to={`/app/${orgSlug}/ai/${c.id}`} className="flex-1 truncate px-2 py-2 text-sm text-gray-700">
              {c.title ?? c.repositoryName ?? "New conversation"}
            </Link>
            <button
              type="button"
              onClick={() => {
                deleteConversation.mutate(c.id);
                if (c.id === activeId) navigate(`/app/${orgSlug}/ai`);
              }}
              className="hidden px-2 text-xs text-gray-400 hover:text-red-600 group-hover:block"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function NewConversationPanel({ orgSlug }: { orgSlug: string }) {
  const { data: repositories } = useRepositories(orgSlug, {});
  const [searchParams] = useSearchParams();
  const [repositoryId, setRepositoryId] = useState<string>(searchParams.get("repositoryId") ?? "");
  const createConversation = useCreateConversation(orgSlug);
  const navigate = useNavigate();

  async function handleStart() {
    const convo = await createConversation.mutateAsync({ repositoryId: repositoryId || undefined });
    navigate(`/app/${orgSlug}/ai/${convo.id}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold text-gray-900">Ask about your codebase</h2>
      <p className="max-w-md text-center text-sm text-gray-500">
        Pick a repository to scope this conversation to, or leave it as organization-wide to search across every
        indexed repository.
      </p>
      <select
        value={repositoryId}
        onChange={(e) => setRepositoryId(e.target.value)}
        className="w-72 rounded border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">All repositories (organization-wide)</option>
        {repositories?.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleStart}
        disabled={createConversation.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Start conversation
      </button>
    </div>
  );
}

function ActiveConversationPanel({ orgSlug, conversationId }: { orgSlug: string; conversationId: string }) {
  const { data: conversation, isLoading } = useConversation(orgSlug, conversationId);
  const { send, cancel, isStreaming, streamingText, activeTools, citations, error } = useSendMessage(orgSlug, conversationId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, streamingText]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    send(trimmed);
  }

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-gray-100 px-6 py-3">
        <p className="text-sm font-medium text-gray-900">{conversation?.repositoryName ?? "Organization-wide"}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {conversation?.messages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            citations={m.citations}
            onCopy={() => navigator.clipboard.writeText(m.content)}
          />
        ))}

        {isStreaming && (
          <div className="space-y-2">
            {activeTools.map((t, i) => (
              <div key={`${t.name}-${i}`} className="text-xs text-gray-400">
                {t.status === "running" ? `Using ${t.name}...` : `${t.name} ${t.status === "SUCCESS" ? "done" : "failed"}`}
              </div>
            ))}
            {streamingText && <MessageBubble role="ASSISTANT" content={streamingText} />}
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}{" "}
            <button type="button" className="ml-2 underline" onClick={() => send(input)}>
              Retry
            </button>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <div className="flex gap-2 border-t border-gray-100 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a question about this repository..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        {isStreaming ? (
          <button type="button" onClick={cancel} className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700">
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send
          </button>
        )}
      </div>
      {citations.length > 0 && !isStreaming && <div className="sr-only">{citations.length} citations</div>}
    </div>
  );
}

export function AiChatPage() {
  const { orgSlug = "", conversationId } = useParams();

  return (
    <div className="-m-4 flex h-[calc(100vh-3.25rem)] md:-m-6">
      <ConversationSidebar orgSlug={orgSlug} activeId={conversationId} />
      {conversationId ? (
        <ActiveConversationPanel orgSlug={orgSlug} conversationId={conversationId} />
      ) : (
        <NewConversationPanel orgSlug={orgSlug} />
      )}
    </div>
  );
}
