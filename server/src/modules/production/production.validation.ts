import { z } from "zod";

const PROVIDERS = ["PROMETHEUS", "GITHUB_ACTIONS"] as const;
const INCIDENT_STATUSES = ["DETECTED", "INVESTIGATING", "ROOT_CAUSED", "RESOLVED", "CLOSED"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const DEPLOYMENT_STATUSES = ["SUCCESS", "FAILED", "ROLLED_BACK", "IN_PROGRESS"] as const;
const CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const createIntegrationSchema = {
  body: z.object({
    provider: z.enum(PROVIDERS),
    name: z.string().min(1).max(200),
    config: z.record(z.string(), z.unknown()),
    credential: z.string().min(1).optional(),
  }),
};

export const createServiceSchema = {
  body: z.object({
    name: z.string().min(1).max(200),
    repositoryId: z.string().uuid().optional(),
    integrationId: z.string().uuid().optional(),
    ownerUserId: z.string().uuid().optional(),
    criticality: z.enum(CRITICALITIES).optional(),
  }),
};

export const createIncidentSchema = {
  body: z.object({
    title: z.string().min(1).max(300),
    severity: z.enum(SEVERITIES),
    serviceId: z.string().uuid().optional(),
  }),
};

export const listDeploymentsQuerySchema = {
  query: z.object({
    serviceId: z.string().uuid().optional(),
    environment: z.string().optional(),
    status: z.enum(DEPLOYMENT_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

export const listIncidentsQuerySchema = {
  query: z.object({
    status: z.enum(INCIDENT_STATUSES).optional(),
    severity: z.enum(SEVERITIES).optional(),
    serviceId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
};
