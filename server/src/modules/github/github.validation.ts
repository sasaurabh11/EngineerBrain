import { z } from "zod";

export const githubCallbackSchema = {
  query: z.object({
    installation_id: z.string(),
    state: z.string(),
    setup_action: z.string().optional(),
  }),
};
