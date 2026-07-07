import { z } from "zod";

export const createOrganizationSchema = {
  body: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    description: z.string().trim().max(500).optional(),
    logoUrl: z.string().url().optional(),
  }),
};

export const updateOrganizationSchema = {
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().max(500).nullable().optional(),
      logoUrl: z.string().url().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
};
