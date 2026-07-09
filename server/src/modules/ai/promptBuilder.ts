import type { ContextBlock } from "./contextBuilder.ts";
import { CITATION_INSTRUCTIONS, SAFETY_INSTRUCTIONS } from "./guardrails.ts";
import type { LlmMessage } from "./llm/provider.ts";

interface RepositoryInfo {
  name: string;
  description: string | null;
  primaryLanguage: string | null;
}

interface HistoryMessage {
  role: "USER" | "ASSISTANT";
  content: string;
}

/** The single place prompts are assembled - nothing else in the codebase should
 * hand-concatenate strings into an LLM request. */
export function buildSystemInstruction(organizationName: string, repository?: RepositoryInfo): string {
  const parts = [
    "You are an AI engineering assistant that answers questions about a specific codebase using retrieved repository context and tools.",
    "Ground every repository-specific answer in retrieved context or tool results. If the available information doesn't answer the question, say so plainly instead of guessing.",
    CITATION_INSTRUCTIONS,
    SAFETY_INSTRUCTIONS,
    `Organization: ${organizationName}`,
  ];

  if (repository) {
    const language = repository.primaryLanguage ? ` (${repository.primaryLanguage})` : "";
    const description = repository.description ? ` - ${repository.description}` : "";
    parts.push(`Repository: ${repository.name}${language}${description}`);
  } else {
    parts.push("This conversation is organization-wide and may span multiple repositories.");
  }

  return parts.join("\n\n");
}

export function buildMessages(context: ContextBlock, history: HistoryMessage[], question: string): LlmMessage[] {
  const messages: LlmMessage[] = history.map((message) => ({
    role: message.role === "USER" ? "user" : "model",
    parts: [{ text: message.content }],
  }));

  const contextPrefix = context.text ? `${context.text}\n\n` : "";
  messages.push({ role: "user", parts: [{ text: `${contextPrefix}${question}` }] });

  return messages;
}
