import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productionApi, type ListDeploymentsFilters, type ListIncidentsFilters } from "../api/production.api";
import type { IncidentSeverity, ProductionProvider, ServiceCriticality } from "../types/production.types";

const ACTIVE_INCIDENT_STATUSES = new Set(["DETECTED", "INVESTIGATING"]);

// --- Integrations ---
export function useIntegrations(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["production", "integrations", orgSlug],
    queryFn: () => productionApi.listIntegrations(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useCreateIntegration(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      name,
      config,
      credential,
    }: {
      provider: ProductionProvider;
      name: string;
      config: Record<string, unknown>;
      credential?: string;
    }) => productionApi.createIntegration(orgSlug, provider, name, config, credential),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production", "integrations", orgSlug] }),
  });
}

export function useRemoveIntegration(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (integrationId: string) => productionApi.removeIntegration(orgSlug, integrationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production", "integrations", orgSlug] }),
  });
}

// --- Services ---
export function useServices(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["production", "services", orgSlug],
    queryFn: () => productionApi.listServices(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useCreateService(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      repositoryId,
      integrationId,
      ownerUserId,
      criticality,
    }: {
      name: string;
      repositoryId?: string;
      integrationId?: string;
      ownerUserId?: string;
      criticality?: ServiceCriticality;
    }) => productionApi.createService(orgSlug, name, repositoryId, integrationId, ownerUserId, criticality),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production", "services", orgSlug] }),
  });
}

export function useServiceHealth(orgSlug: string | undefined, serviceId: string | undefined) {
  return useQuery({
    queryKey: ["production", "service-health", orgSlug, serviceId],
    queryFn: () => productionApi.serviceHealth(orgSlug!, serviceId!),
    enabled: Boolean(orgSlug) && Boolean(serviceId),
  });
}

// --- Deployments ---
export function useDeployments(orgSlug: string | undefined, filters: ListDeploymentsFilters = {}) {
  return useQuery({
    queryKey: ["production", "deployments", orgSlug, filters],
    queryFn: () => productionApi.listDeployments(orgSlug!, filters),
    enabled: Boolean(orgSlug),
  });
}

// --- Incidents ---
export function useIncidents(orgSlug: string | undefined, filters: ListIncidentsFilters = {}) {
  return useQuery({
    queryKey: ["production", "incidents", orgSlug, filters],
    queryFn: () => productionApi.listIncidents(orgSlug!, filters),
    enabled: Boolean(orgSlug),
    refetchInterval: (query) => (query.state.data?.items.some((i) => ACTIVE_INCIDENT_STATUSES.has(i.status)) ? 4000 : false),
  });
}

export function useIncident(orgSlug: string | undefined, incidentId: string | undefined) {
  return useQuery({
    queryKey: ["production", "incident", orgSlug, incidentId],
    queryFn: () => productionApi.getIncident(orgSlug!, incidentId!),
    enabled: Boolean(orgSlug) && Boolean(incidentId),
    refetchInterval: (query) => (query.state.data && ACTIVE_INCIDENT_STATUSES.has(query.state.data.status) ? 4000 : false),
  });
}

export function useIncidentTimeline(orgSlug: string | undefined, incidentId: string | undefined, poll: boolean) {
  return useQuery({
    queryKey: ["production", "incident-timeline", orgSlug, incidentId],
    queryFn: () => productionApi.getTimeline(orgSlug!, incidentId!),
    enabled: Boolean(orgSlug) && Boolean(incidentId),
    refetchInterval: poll ? 4000 : false,
  });
}

export function useIncidentSignals(orgSlug: string | undefined, incidentId: string | undefined, poll: boolean) {
  return useQuery({
    queryKey: ["production", "incident-signals", orgSlug, incidentId],
    queryFn: () => productionApi.getSignals(orgSlug!, incidentId!),
    enabled: Boolean(orgSlug) && Boolean(incidentId),
    refetchInterval: poll ? 4000 : false,
  });
}

export function useRootCause(orgSlug: string | undefined, incidentId: string | undefined, poll: boolean) {
  return useQuery({
    queryKey: ["production", "root-cause", orgSlug, incidentId],
    queryFn: () => productionApi.getRootCause(orgSlug!, incidentId!),
    enabled: Boolean(orgSlug) && Boolean(incidentId),
    retry: false,
    refetchInterval: poll ? 4000 : false,
  });
}

export function useRecommendations(orgSlug: string | undefined, incidentId: string | undefined, poll: boolean) {
  return useQuery({
    queryKey: ["production", "recommendations", orgSlug, incidentId],
    queryFn: () => productionApi.getRecommendations(orgSlug!, incidentId!),
    enabled: Boolean(orgSlug) && Boolean(incidentId),
    retry: false,
    refetchInterval: poll ? 4000 : false,
  });
}

export function useDeclareIncident(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, severity, serviceId }: { title: string; severity: IncidentSeverity; serviceId?: string }) =>
      productionApi.declareIncident(orgSlug, title, severity, serviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production", "incidents", orgSlug] }),
  });
}

// --- Postmortem ---
export function usePostmortem(orgSlug: string | undefined, incidentId: string | undefined) {
  return useQuery({
    queryKey: ["production", "postmortem", orgSlug, incidentId],
    queryFn: () => productionApi.getPostmortem(orgSlug!, incidentId!),
    enabled: Boolean(orgSlug) && Boolean(incidentId),
    retry: false,
  });
}

export function useGeneratePostmortem(orgSlug: string, incidentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => productionApi.generatePostmortem(orgSlug, incidentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production", "postmortem", orgSlug, incidentId] }),
  });
}
