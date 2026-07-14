import { z } from "zod";

export const createApiKeySchema = {
  body: z.object({
    name: z.string().trim().min(1).max(100),
  }),
};
