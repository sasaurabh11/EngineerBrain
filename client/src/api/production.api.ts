import { apiDelete, apiGet, apiPost } from "./axiosClient";
import type {
  Deployment,
  DeploymentStatus,
  Incident,
  IncidentSeverity,
  IncidentSignal,
  IncidentStatus,
  IncidentTimelineEvent,
  Integration,
  PageInfo,
  Postmortem,
  ProductionProvider,
  Recommendation,
  RootCauseAnalysis,
  Service,
  ServiceCriticality,
  ServiceHealth,
} from "../types/production.types";

export interface ListIncidentsFilters {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  serviceId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListDeploymentsFilters {
  serviceId?: string;
  environment?: string;
  status?: DeploymentStatus;
  page?: number;
  pageSize?: number;
}

function toQueryString<T extends object>(filters: T): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const productionApi = {
  // Integrations
  listIntegrations: (orgSlug: string) => apiGet<Integration[]>(`/organizations/${orgSlug}/production/integrations`),
  createIntegration: (orgSlug: string, provider: ProductionProvider, name: string, config: Record<string, unknown>, credential?: string) =>
    apiPost<Integration>(`/organizations/${orgSlug}/production/integrations`, { provider, name, config, credential }),
  removeIntegration: (orgSlug: string, integrationId: string) =>
    apiDelete<{ deleted: boolean }>(`/organizations/${orgSlug}/production/integrations/${integrationId}`),

  // Services
  listServices: (orgSlug: string) => apiGet<Service[]>(`/organizations/${orgSlug}/production/services`),
  createService: (
    orgSlug: string,
    name: string,
    repositoryId?: string,
    integrationId?: string,
    ownerUserId?: string,
    criticality?: ServiceCriticality,
  ) => apiPost<Service>(`/organizations/${orgSlug}/production/services`, { name, repositoryId, integrationId, ownerUserId, criticality }),
  serviceHealth: (orgSlug: string, serviceId: string) => apiGet<ServiceHealth>(`/organizations/${orgSlug}/production/services/${serviceId}/health`),

  // Deployments
  listDeployments: (orgSlug: string, filters: ListDeploymentsFilters = {}) =>
    apiGet<{ items: Deployment[]; pageInfo: PageInfo }>(`/organizations/${orgSlug}/production/deployments${toQueryString(filters)}`),

  // Incidents
  declareIncident: (orgSlug: string, title: string, severity: IncidentSeverity, serviceId?: string) =>
    apiPost<Incident>(`/organizations/${orgSlug}/production/incidents`, { title, severity, serviceId }),
  listIncidents: (orgSlug: string, filters: ListIncidentsFilters = {}) =>
    apiGet<{ items: Incident[]; pageInfo: PageInfo }>(`/organizations/${orgSlug}/production/incidents${toQueryString(filters)}`),
  getIncident: (orgSlug: string, incidentId: string) => apiGet<Incident>(`/organizations/${orgSlug}/production/incidents/${incidentId}`),
  getTimeline: (orgSlug: string, incidentId: string) =>
    apiGet<IncidentTimelineEvent[]>(`/organizations/${orgSlug}/production/incidents/${incidentId}/timeline`),
  getSignals: (orgSlug: string, incidentId: string) =>
    apiGet<IncidentSignal[]>(`/organizations/${orgSlug}/production/incidents/${incidentId}/signals`),
  getRootCause: (orgSlug: string, incidentId: string) =>
    apiGet<RootCauseAnalysis>(`/organizations/${orgSlug}/production/incidents/${incidentId}/root-cause`),
  getRecommendations: (orgSlug: string, incidentId: string) =>
    apiGet<Recommendation[]>(`/organizations/${orgSlug}/production/incidents/${incidentId}/recommendations`),

  // Postmortem
  generatePostmortem: (orgSlug: string, incidentId: string) =>
    apiPost<Postmortem>(`/organizations/${orgSlug}/production/incidents/${incidentId}/postmortem`),
  getPostmortem: (orgSlug: string, incidentId: string) =>
    apiGet<Postmortem>(`/organizations/${orgSlug}/production/incidents/${incidentId}/postmortem`),
};
