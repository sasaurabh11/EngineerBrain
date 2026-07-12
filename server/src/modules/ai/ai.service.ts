import { NotFoundError } from "../../common/errors/AppError.ts";
import { indexingService } from "../indexing/indexing.service.ts";
import { organizationRepository } from "../organization/organization.repository.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import { callAgentStep, callValidate, type ChatMessagePayload } from "./agents/agentClient.ts";
import type { AiStreamEvent, ConversationDetailResponseDto, ConversationResponseDto } from "./ai.types.ts";
import { extractCitations, type CitationCandidate } from "./citations.ts";
import { conversationRepository } from "./conversation.repository.ts";
import { buildContext } from "./contextBuilder.ts";
import { NO_CONTEXT_FOUND_MESSAGE, hasNoContext } from "./guardrails.ts";
import { buildMessages, buildRevisionPrompt, buildSynthesisPrompt, buildSystemInstruction } from "./promptBuilder.ts";
import { toolRegistry } from "./tools/registry.ts";
import type { ToolContext } from "./tools/tool.types.ts";

const MAX_TOOL_ROUNDS = 8;
const HISTORY_LIMIT = 15;
const MAX_EVIDENCE_CHARS = 1000;

function toConversationDto(convo: { id: string; title: string | null; repositoryId: string | null; createdAt: Date; updatedAt: Date; repository?: { name: string } | null }): ConversationResponseDto {
  return {
    id: convo.id,
    title: convo.title,
    repositoryId: convo.repositoryId,
    repositoryName: convo.repository?.name ?? null,
    createdAt: convo.createdAt,
    updatedAt: convo.updatedAt,
  };
}

export const aiService = {
  async createConversation(organizationId: string, userId: string, repositoryId?: string, title?: string): Promise<ConversationResponseDto> {
    if (repositoryId) {
      const repo = await repoRepository.findByOrgAndId(organizationId, repositoryId);
      if (!repo) {
        throw new NotFoundError("Repository not found");
      }
    }

    const convo = await conversationRepository.create(organizationId, userId, repositoryId ?? null, title ?? null);
    return toConversationDto(convo);
  },

  async listConversations(organizationId: string, userId: string): Promise<ConversationResponseDto[]> {
    const conversations = await conversationRepository.listByOrgAndUser(organizationId, userId);
    return conversations.map(toConversationDto);
  },

  async getConversation(organizationId: string, userId: string, id: string): Promise<ConversationDetailResponseDto> {
    const convo = await conversationRepository.findByOrgAndId(organizationId, id);
    if (!convo || convo.userId !== userId) {
      throw new NotFoundError("Conversation not found");
    }

    const detail = await conversationRepository.findWithMessages(id);
    if (!detail) {
      throw new NotFoundError("Conversation not found");
    }

    return {
      ...toConversationDto(detail),
      messages: detail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        toolInvocations: m.toolInvocations.map((t) => ({
          toolName: t.toolName,
          arguments: t.arguments,
          result: t.result,
          status: t.status,
          durationMs: t.durationMs,
        })),
        citations: m.citations.map((c) => ({ filePath: c.filePath, repositoryId: c.repositoryId })),
      })),
    };
  },

  async deleteConversation(organizationId: string, userId: string, id: string): Promise<void> {
    const convo = await conversationRepository.findByOrgAndId(organizationId, id);
    if (!convo || convo.userId !== userId) {
      throw new NotFoundError("Conversation not found");
    }
    await conversationRepository.delete(id);
  },

  async *sendMessage(
    organizationId: string,
    userId: string,
    conversationId: string,
    question: string,
    signal?: AbortSignal,
  ): AsyncGenerator<AiStreamEvent> {
    const convo = await conversationRepository.findByOrgAndId(organizationId, conversationId);
    if (!convo || convo.userId !== userId) {
      throw new NotFoundError("Conversation not found");
    }

    await conversationRepository.createMessage(conversationId, "USER", question);

    const [organization, repository, context] = await Promise.all([
      organizationRepository.findById(organizationId),
      convo.repositoryId ? repoRepository.findById(convo.repositoryId) : Promise.resolve(null),
      buildContext(organizationId, question, convo.repositoryId ?? undefined),
    ]);

    if (convo.repositoryId && hasNoContext(context.chunks)) {
      const status = await indexingService.getStatus(convo.repositoryId);
      if (status.totalChunks === 0) {
        const assistantMessage = await conversationRepository.createMessage(conversationId, "ASSISTANT", NO_CONTEXT_FOUND_MESSAGE);
        await conversationRepository.touchUpdatedAt(conversationId);
        yield { type: "text-delta", text: NO_CONTEXT_FOUND_MESSAGE };
        yield { type: "done", messageId: assistantMessage.id, citations: [] };
        return;
      }
    }

    const priorMessages = await conversationRepository.listRecentMessages(conversationId, HISTORY_LIMIT);
    const history = priorMessages
      .slice(0, -1) // exclude the USER message we just inserted - buildMessages appends `question` itself
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .map((m) => ({ role: m.role as "USER" | "ASSISTANT", content: m.content }));

    const systemContext = buildSystemInstruction(
      organization?.name ?? "this organization",
      repository ? { name: repository.name, description: repository.description, primaryLanguage: repository.primaryLanguage } : undefined,
    );
    let messages: ChatMessagePayload[] = buildMessages(context, history, question);

    const toolCtx: ToolContext = { organizationId, userId, repositoryId: convo.repositoryId ?? undefined };
    const citationsByPath = new Map<string, CitationCandidate>();
    const evidence: string[] = [];
    for (const chunk of context.chunks) {
      citationsByPath.set(chunk.filePath, { chunkId: chunk.chunkId, filePath: chunk.filePath, repositoryId: chunk.repositoryId });
      evidence.push(`${chunk.filePath}: ${chunk.content.slice(0, MAX_EVIDENCE_CHARS)}`);
    }

    const pendingToolInvocations: { toolName: string; arguments: unknown; result: unknown; status: "SUCCESS" | "FAILED"; durationMs: number }[] = [];

    // --- Retriever: gather information by calling tools, round by round ---
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      // Reserve the last round as tool-free so the model is forced to stop
      // gathering and hand off to the Synthesizer, instead of attempting
      // another tool call and running out of rounds with nothing to show.
      const isFinalRound = round === MAX_TOOL_ROUNDS - 1;
      const tools = isFinalRound ? [] : toolRegistry.readOnlySchemas();

      let step;
      try {
        step = await callAgentStep("retriever", messages, tools, systemContext, signal);
      } catch (err) {
        yield { type: "error", message: err instanceof Error ? err.message : "Retriever agent call failed" };
        break;
      }

      messages = [...messages, step.message];
      if (step.done) {
        break;
      }

      for (const call of step.message.tool_calls ?? []) {
        yield { type: "tool-call", name: call.name, args: call.args };
        const startedAt = Date.now();
        let result: unknown;
        let status: "SUCCESS" | "FAILED" = "SUCCESS";

        try {
          const tool = toolRegistry.get(call.name);
          if (!tool) {
            throw new Error(`Unknown tool: ${call.name}`);
          }
          result = await tool.execute(call.args, toolCtx);
          for (const citation of extractCitations(result)) {
            citationsByPath.set(citation.filePath, citation);
          }
        } catch (err) {
          status = "FAILED";
          result = { error: err instanceof Error ? err.message : "Tool execution failed" };
        }

        yield { type: "tool-result", name: call.name, status };
        pendingToolInvocations.push({ toolName: call.name, arguments: call.args, result, status, durationMs: Date.now() - startedAt });
        evidence.push(`${call.name}(${JSON.stringify(call.args)}) -> ${JSON.stringify(result).slice(0, MAX_EVIDENCE_CHARS)}`);
        messages = [...messages, { role: "tool", content: JSON.stringify(result), tool_call_id: call.id, name: call.name }];
      }
    }

    // --- Synthesizer: write the final answer from a fresh, clean prompt built
    // from the gathered evidence - NOT by replaying the retriever's raw
    // multi-round transcript, since Gemini's thinking models can hallucinate a
    // tool call even with no tools bound once several tool rounds accumulate. ---
    let assembledText = "";
    try {
      const synthesisMessages: ChatMessagePayload[] = [{ role: "user", content: buildSynthesisPrompt(question, evidence) }];
      const synthesis = await callAgentStep("synthesizer", synthesisMessages, [], systemContext, signal);
      assembledText = synthesis.message.content ?? "";

      // --- Critic: one bounded grounding check + revision, not persisted ---
      const verdict = await callValidate(assembledText, evidence, signal);
      if (!verdict.passed) {
        const revisionMessages: ChatMessagePayload[] = [
          { role: "user", content: buildRevisionPrompt(question, evidence, assembledText, verdict.issues) },
        ];
        const revision = await callAgentStep("synthesizer", revisionMessages, [], systemContext, signal);
        assembledText = revision.message.content ?? assembledText;
      }
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : "Synthesizer agent call failed" };
    }

    yield { type: "text-delta", text: assembledText };

    const assistantMessage = await conversationRepository.createMessage(conversationId, "ASSISTANT", assembledText);
    for (const invocation of pendingToolInvocations) {
      await conversationRepository.createToolInvocation(
        assistantMessage.id,
        invocation.toolName,
        invocation.arguments,
        invocation.result,
        invocation.status,
        invocation.durationMs,
      );
    }
    const citations = Array.from(citationsByPath.values());
    await conversationRepository.createCitations(assistantMessage.id, citations);
    await conversationRepository.touchUpdatedAt(conversationId);

    yield { type: "done", messageId: assistantMessage.id, citations };
  },
};
