import type { Request, Response } from "express";
import { AppError, NotFoundError } from "../../common/errors/AppError.ts";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { resolveAiProviderConfig } from "../../infra/aiService/providerConfig.ts";
import { aiService } from "./ai.service.ts";
import { conversationRepository } from "./conversation.repository.ts";
import { toolRegistry } from "./tools/registry.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

export const aiController = {
  async createConversation(req: Request, res: Response) {
    const convo = await aiService.createConversation(req.organization!.id, req.dbUser!.id, req.body.repositoryId, req.body.title);
    sendSuccess(res, convo, 201);
  },

  async listConversations(req: Request, res: Response) {
    const conversations = await aiService.listConversations(req.organization!.id, req.dbUser!.id);
    sendSuccess(res, conversations);
  },

  async getConversation(req: Request, res: Response) {
    const convo = await aiService.getConversation(req.organization!.id, req.dbUser!.id, getParam(req, "id"));
    sendSuccess(res, convo);
  },

  async deleteConversation(req: Request, res: Response) {
    await aiService.deleteConversation(req.organization!.id, req.dbUser!.id, getParam(req, "id"));
    sendSuccess(res, { deleted: true });
  },

  listTools(_req: Request, res: Response) {
    sendSuccess(res, toolRegistry.schemas());
  },

  async sendMessage(req: Request, res: Response) {
    const conversationId = getParam(req, "id");

    // Validate ownership before switching into SSE mode so a bad/foreign
    // conversation id gets a normal JSON 404 instead of a 200 + error event.
    const convo = await conversationRepository.findByOrgAndId(req.organization!.id, conversationId);
    if (!convo || convo.userId !== req.dbUser!.id) {
      throw new NotFoundError("Conversation not found");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const abortController = new AbortController();
    req.on("close", () => abortController.abort());

    const sendEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const event of aiService.sendMessage(
        req.organization!.id,
        req.dbUser!.id,
        conversationId,
        req.body.message,
        abortController.signal,
        resolveAiProviderConfig(req.dbUser!),
      )) {
        sendEvent(event);
      }
    } catch (err) {
      const message = err instanceof AppError ? err.message : "Internal server error";
      const code = err instanceof AppError ? err.code : undefined;
      sendEvent({ type: "error", message, code });
    } finally {
      res.end();
    }
  },
};
