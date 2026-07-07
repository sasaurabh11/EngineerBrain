import { z } from "zod";

export const updateMeSchema = {
  body: z.object({
    name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  }),
};
