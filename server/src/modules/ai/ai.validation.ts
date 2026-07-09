import { z } from "zod";

export const createConversationSchema = {
  body: z.object({
    repositoryId: z.string().uuid().optional(),
    title: z.string().min(1).max(200).optional(),
  }),
};

export const sendMessageSchema = {
  body: z.object({
    message: z.string().min(1).max(8000),
  }),
};
