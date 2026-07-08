import { z } from "zod";

export const importRepositoriesSchema = {
  body: z.object({
    githubRepoIds: z.array(z.string().min(1)).min(1),
  }),
};

export const listRepositoriesQuerySchema = {
  query: z.object({
    search: z.string().optional(),
    language: z.string().optional(),
    sort: z.enum(["name", "stars", "updated", "imported"]).optional(),
  }),
};
