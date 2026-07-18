import { z } from "zod";

export const updateMeSchema = {
  body: z.object({
    name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  }),
};

export const updateAiSettingsSchema = {
  body: z.object({
    provider: z.enum(["GEMINI", "GROQ"]).optional(),
    geminiApiKey: z.string().trim().min(1, "API key cannot be empty").nullable().optional(),
    groqApiKey: z.string().trim().min(1, "API key cannot be empty").nullable().optional(),
  }),
};
