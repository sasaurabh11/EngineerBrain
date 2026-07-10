import { apiGet, apiPost } from "./axiosClient";
import type { Finding, FindingCategory, FindingSeverity, RepositoryAnalysis } from "../types/analysis.types";

function toQueryString(filters: { category?: FindingCategory; severity?: FindingSeverity }): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.severity) params.set("severity", filters.severity);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const analysisApi = {
  status: (orgSlug: string, repositoryId: string) =>
    apiGet<RepositoryAnalysis | null>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis/status`),
  latest: (orgSlug: string, repositoryId: string) =>
    apiGet<RepositoryAnalysis>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis`),
  findings: (orgSlug: string, repositoryId: string, filters: { category?: FindingCategory; severity?: FindingSeverity } = {}) =>
    apiGet<Finding[]>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis/findings${toQueryString(filters)}`),
  history: (orgSlug: string, repositoryId: string) =>
    apiGet<RepositoryAnalysis[]>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis/history`),
  trigger: (orgSlug: string, repositoryId: string) =>
    apiPost<{ triggered: boolean }>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis`),
};
