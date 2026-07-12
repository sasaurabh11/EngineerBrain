import type { ChatMessagePayload } from "./agents/agentClient.ts";
import type { ContextBlock } from "./contextBuilder.ts";
import { CITATION_INSTRUCTIONS, SAFETY_INSTRUCTIONS } from "./guardrails.ts";

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
    "Ground every repository-specific claim (about this codebase's code, architecture, or data) in retrieved context or tool results. If the available information doesn't answer a repository-specific question, say so plainly instead of guessing. This grounding requirement does not apply to ordinary general-knowledge questions unrelated to the repository (e.g. basic facts, definitions, or arithmetic) - answer those directly.",
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

function formatEvidence(evidence: string[]): string {
  return evidence.length > 0 ? evidence.map((e) => `- ${e}`).join("\n") : "(no information was gathered)";
}

/** Builds a FRESH, short prompt for the Synthesizer rather than replaying the
 * full multi-round retriever transcript - Gemini's thinking models can
 * hallucinate a tool call even with no tools bound once several rounds of
 * tool-calling history have accumulated, so the final answer is always
 * produced from a clean, short context built from the gathered evidence. */
export function buildSynthesisPrompt(question: string, evidence: string[]): string {
  return (
    `Original question: ${question}\n\nInformation gathered:\n${formatEvidence(evidence)}\n\n` +
    "Write the final answer to the original question. Ground any repository-specific claim in the information " +
    "gathered above; ordinary general-knowledge questions can be answered directly."
  );
}

export function buildRevisionPrompt(question: string, evidence: string[], previousAnswer: string, issues: string[]): string {
  return (
    `Original question: ${question}\n\nInformation gathered:\n${formatEvidence(evidence)}\n\n` +
    `Previous answer: ${previousAnswer}\n\nThat answer had grounding issues: ${issues.join("; ")}. Write a corrected ` +
    "final answer using only the gathered information."
  );
}

export function buildMessages(context: ContextBlock, history: HistoryMessage[], question: string): ChatMessagePayload[] {
  const messages: ChatMessagePayload[] = history.map((message) => ({
    role: message.role === "USER" ? "user" : "assistant",
    content: message.content,
  }));

  const contextPrefix = context.text ? `${context.text}\n\n` : "";
  messages.push({ role: "user", content: `${contextPrefix}${question}` });

  return messages;
}
