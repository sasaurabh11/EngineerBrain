import { z } from "zod";

export const searchQuerySchema = {
  query: z.object({
    q: z.string().min(1, "Query is required"),
  }),
};
