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
    <SyntaxHighlighter language={match[1]} style={oneDark} PreTag="div" customStyle={{ borderRadius: 8, fontSize: 13, margin: 0 }}>
      {codeText}
    </SyntaxHighlighter>
  );
}


export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
        {content}
      </Markdown>
    </div>
  );
}
