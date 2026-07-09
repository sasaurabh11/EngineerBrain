import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
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
    return <code className="rounded bg-gray-100 px-1 py-0.5 text-sm text-gray-800">{children}</code>;
  }

  return (
    <SyntaxHighlighter language={match[1]} style={oneDark} PreTag="div" customStyle={{ borderRadius: 6, fontSize: 13 }}>
      {codeText}
    </SyntaxHighlighter>
  );
}

export function MessageBubble({ role, content, citations, onCopy }: MessageBubbleProps) {
  const isUser = role === "USER";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`group relative max-w-2xl rounded-lg px-4 py-3 ${isUser ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-900"}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
              {content}
            </Markdown>
          </div>
        )}

        {!isUser && citations && citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
            {citations.map((c) => (
              <span key={`${c.repositoryId}-${c.filePath}`} className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
                {c.filePath}
              </span>
            ))}
          </div>
        )}

        {!isUser && onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="absolute -bottom-2 -right-2 hidden rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-500 hover:text-gray-900 group-hover:block"
          >
            Copy
          </button>
        )}
      </div>
    </div>
  );
}
