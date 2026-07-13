import { Bot, Check, Copy, FileCode2 } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Citation } from "../../../types/ai.types";

interface MessageBubbleProps {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  citations?: Citation[];
  onCopy?: () => void;
}

function CodeBlock(props: { className?: string; children?: React.ReactNode }) {
  const { className, children } = props;
  const match = /language-(\w+)/.exec(className ?? "");
  const codeText = String(children ?? "").replace(/\n$/, "");

  if (!match) {
    return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
  }

  return (
    <SyntaxHighlighter language={match[1]} style={oneDark} PreTag="div" customStyle={{ borderRadius: 8, fontSize: 13, margin: 0 }}>
      {codeText}
    </SyntaxHighlighter>
  );
}

export function MessageBubble({ role, content, citations, onCopy }: MessageBubbleProps) {
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
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
            <Markdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
              {content}
            </Markdown>
          </div>
        )}

        {!isUser && citations && citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
            {citations.map((c) => (
              <Badge key={`${c.repositoryId}-${c.filePath}`} variant="secondary" className="gap-1 font-mono font-normal">
                <FileCode2 className="size-3" />
                {c.filePath}
              </Badge>
            ))}
          </div>
        )}

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
