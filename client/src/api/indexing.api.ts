import { apiGet, apiPost } from "./axiosClient";
import type { RepositoryIndexStatus } from "../types/indexing.types";

export const indexingApi = {
  status: (orgSlug: string, repositoryId: string) =>
    apiGet<RepositoryIndexStatus>(`/organizations/${orgSlug}/repositories/${repositoryId}/index/status`),
  trigger: (orgSlug: string, repositoryId: string) =>
    apiPost<{ triggered: boolean }>(`/organizations/${orgSlug}/repositories/${repositoryId}/index`),
  reindex: (orgSlug: string, repositoryId: string) =>
    apiPost<{ triggered: boolean }>(`/organizations/${orgSlug}/repositories/${repositoryId}/reindex`),
};
