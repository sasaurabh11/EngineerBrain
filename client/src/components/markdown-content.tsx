import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

function CodeBlock(props: { className?: string; children?: React.ReactNode }) {
  const { className, children } = props;
  const match = /language-(\w+)/.exec(className ?? "");
  const codeText = String(children ?? "").replace(/\n$/, "");

  if (!match) {
    return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
  }

  return (
    <div className="overflow-x-auto">
      <SyntaxHighlighter language={match[1]} style={oneDark} PreTag="div" customStyle={{ borderRadius: 8, fontSize: 13, margin: 0 }}>
        {codeText}
      </SyntaxHighlighter>
    </div>
  );
}

// Wide GFM tables must scroll within their own container, never force the
// chat bubble (a flex item with a max-width) wider than it - see min-w-0 on
// MessageBubble's bubble div for the other half of this fix.
function Table(props: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  );
}

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock, table: Table }}>
        {content}
      </Markdown>
    </div>
  );
}
