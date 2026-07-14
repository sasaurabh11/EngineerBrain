import { z } from "zod";

export const symbolSourceQuerySchema = {
  query: z.object({
    name: z.string().trim().min(1),
    kind: z.enum(["class", "function"]).optional(),
  }),
};
