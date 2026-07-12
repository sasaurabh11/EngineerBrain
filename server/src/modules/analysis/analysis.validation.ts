import { z } from "zod";

const CATEGORIES = ["QUALITY", "SECURITY", "PERFORMANCE", "ARCHITECTURE", "DEPENDENCY", "PATTERN", "SOLID"] as const;
const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const FINDING_SORT_FIELDS = ["severity", "priority", "confidence", "createdAt"] as const;
const SORT_ORDERS = ["asc", "desc"] as const;

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);

export const listFindingsQuerySchema = {
  query: z.object({
    category: z.enum(CATEGORIES).optional(),
    severity: z.enum(SEVERITIES).optional(),
    priority: z.enum(SEVERITIES).optional(),
    page,
    pageSize,
    sortBy: z.enum(FINDING_SORT_FIELDS).default("severity"),
    sortOrder: z.enum(SORT_ORDERS).default("desc"),
  }),
};

export const listHistoryQuerySchema = {
  query: z.object({
    page,
    pageSize,
  }),
};

export const trendQuerySchema = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};
