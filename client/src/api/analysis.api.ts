import { apiClient, apiGet, apiPost } from "./axiosClient";
import type { Finding, FindingsFilters, PageInfo, RepositoryAnalysis } from "../types/analysis.types";

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface JsonReport {
  repository: { id: string; name: string };
  scores: Record<string, number | null>;
  architectureSummary: string | null;
  findings: Finding[];
  generatedAt: string;
}

export const analysisApi = {
  status: (orgSlug: string, repositoryId: string) =>
    apiGet<RepositoryAnalysis | null>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis/status`),
  latest: (orgSlug: string, repositoryId: string) =>
    apiGet<RepositoryAnalysis>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis`),
  findings: (orgSlug: string, repositoryId: string, filters: FindingsFilters = {}) =>
    apiGet<{ items: Finding[]; pageInfo: PageInfo }>(
      `/organizations/${orgSlug}/repositories/${repositoryId}/analysis/findings${toQueryString(filters)}`,
    ),
  history: (orgSlug: string, repositoryId: string, page = 1, pageSize = 20) =>
    apiGet<{ items: RepositoryAnalysis[]; pageInfo: PageInfo }>(
      `/organizations/${orgSlug}/repositories/${repositoryId}/analysis/history${toQueryString({ page, pageSize })}`,
    ),
  trend: (orgSlug: string, repositoryId: string, limit = 20) =>
    apiGet<RepositoryAnalysis[]>(
      `/organizations/${orgSlug}/repositories/${repositoryId}/analysis/trend${toQueryString({ limit })}`,
    ),
  trigger: (orgSlug: string, repositoryId: string) =>
    apiPost<{ triggered: boolean }>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis`),
  retry: (orgSlug: string, repositoryId: string, analysisId: string) =>
    apiPost<{ retried: boolean }>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis/${analysisId}/retry`),
  cancel: (orgSlug: string, repositoryId: string, analysisId: string) =>
    apiPost<{ cancelled: boolean }>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis/${analysisId}/cancel`),
  reportJson: (orgSlug: string, repositoryId: string) =>
    apiGet<JsonReport>(`/organizations/${orgSlug}/repositories/${repositoryId}/analysis/report/json`),
  // Markdown report isn't wrapped in the standard {success,data} envelope (it's
  // sent as a plain file download), so it bypasses apiGet and reads raw text.
  reportMarkdown: async (orgSlug: string, repositoryId: string): Promise<string> => {
    const { data } = await apiClient.get<string>(
      `/organizations/${orgSlug}/repositories/${repositoryId}/analysis/report/markdown`,
      { responseType: "text" },
    );
    return data;
  },
};

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
