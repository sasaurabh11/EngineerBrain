import type { MessageRole, Prisma, ToolInvocationStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";

export const conversationRepository = {
  create(organizationId: string, userId: string, repositoryId: string | null, title: string | null) {
    return prisma.conversation.create({ data: { organizationId, userId, repositoryId, title } });
  },

  findByOrgAndId(organizationId: string, id: string) {
    return prisma.conversation.findFirst({ where: { id, organizationId } });
  },

  listByOrgAndUser(organizationId: string, userId: string) {
    return prisma.conversation.findMany({
      where: { organizationId, userId },
      orderBy: { updatedAt: "desc" },
      include: { repository: { select: { id: true, name: true } } },
    });
  },

  findWithMessages(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { citations: true, toolInvocations: true },
        },
        repository: { select: { id: true, name: true } },
      },
    });
  },

  async listRecentMessages(conversationId: string, limit: number) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return messages.reverse();
  },

  touchUpdatedAt(id: string) {
    return prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
  },

  delete(id: string) {
    return prisma.conversation.delete({ where: { id } });
  },

  createMessage(conversationId: string, role: MessageRole, content: string) {
    return prisma.message.create({ data: { conversationId, role, content } });
  },

  createToolInvocation(
    messageId: string,
    toolName: string,
    args: unknown,
    result: unknown,
    status: ToolInvocationStatus,
    durationMs: number,
  ) {
    return prisma.toolInvocation.create({
      data: {
        messageId,
        toolName,
        arguments: args as Prisma.InputJsonValue,
        result: result as Prisma.InputJsonValue,
        status,
        durationMs,
      },
    });
  },

  createCitations(messageId: string, citations: { chunkId: string | null; filePath: string; repositoryId: string }[]) {
    if (citations.length === 0) {
      return Promise.resolve();
    }
    return prisma.citation.createMany({
      data: citations.map((c) => ({ messageId, chunkId: c.chunkId, filePath: c.filePath, repositoryId: c.repositoryId })),
    });
  },
};
