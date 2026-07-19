import { Bot, Check, ChevronDown, Copy, FileCode2, Wrench } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { Citation, ToolInvocation } from "../../../types/ai.types";

const TOOL_STATUS_TONE: Record<string, StatusTone> = {
  SUCCESS: "success",
  FAILED: "danger",
};

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** The permanent record of what the assistant actually did to answer - the
 * live ToolCallChip trace during streaming disappears once a message is
 * saved, so this renders the same information from the persisted
 * `toolInvocations` field instead of leaving it invisible after the fact. */
function ToolInvocationTrace({ invocations }: { invocations: ToolInvocation[] }) {
  const [expanded, setExpanded] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-3 border-t border-border pt-2.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Wrench className="size-3" />
        {invocations.length} action{invocations.length === 1 ? "" : "s"} taken
        <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1.5">
          {invocations.map((tool, i) => (
            <li key={i} className="rounded-md border border-border bg-muted/30">
              <button
                type="button"
                onClick={() => setOpenIndex((v) => (v === i ? null : i))}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
              >
                <span className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-foreground">{tool.toolName}</span>
                  {tool.durationMs !== null && <span className="text-muted-foreground">{tool.durationMs}ms</span>}
                </span>
                <StatusBadge tone={TOOL_STATUS_TONE[tool.status] ?? "neutral"}>{tool.status.toLowerCase()}</StatusBadge>
              </button>
              {openIndex === i && (
                <div className="space-y-2 border-t border-border px-2.5 py-2 text-xs">
                  <div>
                    <p className="mb-1 font-medium text-foreground">Arguments</p>
                    <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-muted-foreground">{safeStringify(tool.arguments)}</pre>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-foreground">Result</p>
                    <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-muted-foreground">{safeStringify(tool.result)}</pre>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  citations?: Citation[];
  toolInvocations?: ToolInvocation[];
  onCopy?: () => void;
}

export function MessageBubble({ role, content, citations, toolInvocations, onCopy }: MessageBubbleProps) {
  const isUser = role === "USER";
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
      )}

      <div className={cn("group relative max-w-2xl rounded-xl px-4 py-3", isUser ? "bg-primary text-primary-foreground" : "border border-border bg-card")}>
        {isUser ? <p className="text-sm whitespace-pre-wrap">{content}</p> : <MarkdownContent content={content} />}

        {!isUser && citations && citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
            {citations.map((c) => (
              <Badge key={`${c.repositoryId}-${c.filePath}`} variant="secondary" className="max-w-full gap-1 font-mono font-normal">
                <FileCode2 className="size-3 shrink-0" />
                <span className="truncate">{c.filePath}</span>
              </Badge>
            ))}
          </div>
        )}

        {!isUser && toolInvocations && toolInvocations.length > 0 && <ToolInvocationTrace invocations={toolInvocations} />}

        {!isUser && onCopy && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            aria-label="Copy message"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}
