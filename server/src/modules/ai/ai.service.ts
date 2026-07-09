import { NotFoundError } from "../../common/errors/AppError.ts";
import { indexingService } from "../indexing/indexing.service.ts";
import { organizationRepository } from "../organization/organization.repository.ts";
import { repoRepository } from "../repo/repo.repository.ts";
import type { AiStreamEvent, ConversationDetailResponseDto, ConversationResponseDto } from "./ai.types.ts";
import { extractCitations, type CitationCandidate } from "./citations.ts";
import { conversationRepository } from "./conversation.repository.ts";
import { buildContext } from "./contextBuilder.ts";
import { NO_CONTEXT_FOUND_MESSAGE, hasNoContext } from "./guardrails.ts";
import { geminiProvider } from "./llm/geminiProvider.ts";
import type { LlmMessage, LlmPart } from "./llm/provider.ts";
import { buildMessages, buildSystemInstruction } from "./promptBuilder.ts";
import { toolRegistry } from "./tools/registry.ts";
import type { ToolContext } from "./tools/tool.types.ts";

const MAX_TOOL_ROUNDS = 5;
const HISTORY_LIMIT = 20;

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

    const systemInstruction = buildSystemInstruction(
      organization?.name ?? "this organization",
      repository ? { name: repository.name, description: repository.description, primaryLanguage: repository.primaryLanguage } : undefined,
    );
    const messages: LlmMessage[] = buildMessages(context, history, question);

    const toolCtx: ToolContext = { organizationId, userId, repositoryId: convo.repositoryId ?? undefined };
    const citationsByPath = new Map<string, CitationCandidate>();
    for (const chunk of context.chunks) {
      citationsByPath.set(chunk.filePath, { chunkId: chunk.chunkId, filePath: chunk.filePath, repositoryId: chunk.repositoryId });
    }

    const pendingToolInvocations: { toolName: string; arguments: unknown; result: unknown; status: "SUCCESS" | "FAILED"; durationMs: number }[] = [];
    let assembledText = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const toolCalls: { id: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }[] = [];
      let streamErrored = false;

      for await (const event of geminiProvider.streamChat({ systemInstruction, messages, tools: toolRegistry.schemas(), signal })) {
        if (event.type === "text-delta") {
          assembledText += event.text;
          yield { type: "text-delta", text: event.text };
        } else if (event.type === "tool-call") {
          toolCalls.push(event);
        } else if (event.type === "error") {
          streamErrored = true;
          yield { type: "error", message: event.message };
        }
      }

      if (streamErrored) {
        break;
      }

      if (toolCalls.length === 0) {
        break;
      }

      messages.push({
        role: "model",
        parts: toolCalls.map(
          (call): LlmPart => ({
            functionCall: { id: call.id, name: call.name, args: call.args },
            thoughtSignature: call.thoughtSignature,
          }),
        ),
      });

      const responseParts: LlmPart[] = [];
      for (const call of toolCalls) {
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
        responseParts.push({ functionResponse: { id: call.id, name: call.name, response: result as Record<string, unknown> } });
      }

      messages.push({ role: "user", parts: responseParts });
    }

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
