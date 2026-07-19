import { Bot, FileCode2, Loader2, Menu, MessageSquare, Plus, Send, Sparkles, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GoToProfileAction } from "@/components/go-to-profile-action";
import { CircuitField } from "@/components/circuit-field";
import { cn } from "@/lib/utils";
import { useRepositories } from "../../hooks/useRepositories";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useSendMessage,
} from "../../hooks/useAi";
import { MessageBubble } from "./components/MessageBubble";

const SUGGESTED_QUESTIONS = [
  "What is this repository's overall health score?",
  "What are the biggest security risks here?",
  "Explain how authentication works in this codebase.",
  "Where is the main entry point of this service?",
];

function ConversationSidebar({
  orgSlug,
  activeId,
  onNavigate,
}: {
  orgSlug: string;
  activeId: string | undefined;
  onNavigate?: () => void;
}) {
  const { data: conversations } = useConversations(orgSlug);
  const deleteConversation = useDeleteConversation(orgSlug);
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border p-3">
        <Button asChild className="w-full justify-start gap-2">
          <Link to={`/app/${orgSlug}/ai`} onClick={onNavigate}>
            <Plus className="size-4" /> New chat
          </Link>
        </Button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {conversations?.length === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">No conversations yet</p>
        )}
        {conversations?.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group relative flex items-center rounded-md",
              c.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
            )}
          >
            <span
              className={cn(
                "absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-primary transition-transform duration-200",
                c.id === activeId ? "scale-y-100" : "scale-y-0",
              )}
            />
            <Link to={`/app/${orgSlug}/ai/${c.id}`} onClick={onNavigate} className="flex-1 truncate px-3 py-2 text-sm">
              {c.title ?? c.repositoryName ?? "New conversation"}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mr-1 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label="Delete conversation"
              onClick={() => {
                deleteConversation.mutate(c.id);
                if (c.id === activeId) navigate(`/app/${orgSlug}/ai`);
              }}
            >
              <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewConversationPanel({ orgSlug }: { orgSlug: string }) {
  const { data: repositories } = useRepositories(orgSlug, {});
  const [searchParams] = useSearchParams();
  const [repositoryId, setRepositoryId] = useState<string>(searchParams.get("repositoryId") ?? "");
  const createConversation = useCreateConversation(orgSlug);
  const navigate = useNavigate();

  async function handleStart(initialQuestion?: string) {
    const convo = await createConversation.mutateAsync({ repositoryId: repositoryId || undefined });
    navigate(`/app/${orgSlug}/ai/${convo.id}${initialQuestion ? `?q=${encodeURIComponent(initialQuestion)}` : ""}`);
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8">
      <CircuitField
        density={0.9}
        className="pointer-events-none absolute inset-0 opacity-[0.3] [mask-image:radial-gradient(ellipse_55%_50%_at_50%_45%,black,transparent_75%)] dark:opacity-[0.2]"
      />
      <div className="relative flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary animate-fade-up">
        <Sparkles className="size-6" />
      </div>
      <div className="relative space-y-1.5 text-center animate-fade-up" style={{ animationDelay: "40ms" }}>
        <h2 className="text-lg font-semibold text-foreground">Ask about your codebase</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Pick a repository to scope this conversation to, or leave it organization-wide to search across every indexed repository.
        </p>
      </div>

      <div className="relative animate-fade-up" style={{ animationDelay: "80ms" }}>
        <Select value={repositoryId || "all"} onValueChange={(v) => setRepositoryId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full max-w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All repositories (organization-wide)</SelectItem>
            {repositories?.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        onClick={() => handleStart()}
        disabled={createConversation.isPending}
        className="relative animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
        {createConversation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Start conversation
      </Button>

      <div className="relative mt-2 grid w-full max-w-lg gap-2 animate-fade-up" style={{ animationDelay: "120ms" }}>
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleStart(q)}
            disabled={createConversation.isPending}
            className="hover-lift rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolCallChip({ name, status }: { name: string; status: "running" | "SUCCESS" | "FAILED" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      {status === "running" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : status === "SUCCESS" ? (
        <span className="size-1.5 rounded-full bg-success" />
      ) : (
        <span className="size-1.5 rounded-full bg-destructive" />
      )}
      {name}
    </span>
  );
}

function ActiveConversationPanel({ orgSlug, conversationId }: { orgSlug: string; conversationId: string }) {
  const { data: conversation, isLoading, isError, refetch } = useConversation(orgSlug, conversationId);
  const { send, cancel, isStreaming, streamingText, activeTools, citations, error, errorCode } = useSendMessage(orgSlug, conversationId);
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, streamingText]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSentRef.current) {
      autoSentRef.current = true;
      send(q);
    }
  }, [searchParams, send]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    send(trimmed);
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <ErrorState title="Failed to load conversation" message="Something went wrong fetching this conversation." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading conversation…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        <Bot className="size-4 text-muted-foreground" />
        <p className="font-mono text-sm font-medium text-foreground">{conversation?.repositoryName ?? "Organization-wide"}</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {conversation?.messages.length === 0 && !isStreaming && (
          <EmptyState icon={MessageSquare} title="No messages yet" description="Ask a question to get started." />
        )}

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
          <div className="flex gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <div className="max-w-2xl space-y-2.5">
              {activeTools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeTools.map((t, i) => (
                    <ToolCallChip key={`${t.name}-${i}`} name={t.name} status={t.status} />
                  ))}
                </div>
              )}
              {streamingText ? (
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
                  {citations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
                      {citations.map((c) => (
                        <Badge key={`${c.repositoryId}-${c.filePath}`} variant="secondary" className="max-w-full gap-1 font-mono font-normal">
                          <FileCode2 className="size-3 shrink-0" />
                          <span className="truncate">{c.filePath}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                activeTools.length === 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Thinking…
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {error && <ErrorState message={error} onRetry={() => send(input)} action={<GoToProfileAction code={errorCode} />} />}

        <div ref={scrollRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border p-4">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a question about this repository…"
          rows={1}
          className="max-h-40 min-h-9 resize-none"
        />
        {isStreaming ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" onClick={cancel} aria-label="Stop generating">
                <Square className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop generating</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="button" size="icon" onClick={handleSend} disabled={!input.trim()} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function AiChatPage() {
  const { orgSlug = "", conversationId } = useParams();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="-m-4 flex h-[calc(100vh-3.25rem)] md:-m-6">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex">
        <ConversationSidebar orgSlug={orgSlug} activeId={conversationId} />
      </aside>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="p-3">
            <SheetTitle className="text-sm">Conversations</SheetTitle>
          </SheetHeader>
          <ConversationSidebar orgSlug={orgSlug} activeId={conversationId} onNavigate={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border p-2 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(true)} aria-label="Open conversations">
            <Menu className="size-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">Conversations</span>
        </div>
        {conversationId ? (
          <ActiveConversationPanel orgSlug={orgSlug} conversationId={conversationId} />
        ) : (
          <NewConversationPanel orgSlug={orgSlug} />
        )}
      </div>
    </div>
  );
}
