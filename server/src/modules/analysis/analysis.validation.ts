import { z } from "zod";

const CATEGORIES = ["QUALITY", "SECURITY", "PERFORMANCE", "ARCHITECTURE", "DEPENDENCY", "PATTERN", "SOLID"] as const;
const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const listFindingsQuerySchema = {
  query: z.object({
    category: z.enum(CATEGORIES).optional(),
    severity: z.enum(SEVERITIES).optional(),
  }),
};
