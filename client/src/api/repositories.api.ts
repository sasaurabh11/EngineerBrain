import { apiDelete, apiGet, apiPost } from "./axiosClient";
import type {
  AvailableRepository,
  Branch,
  Commit,
  Contributor,
  Issue,
  ListRepositoriesFilters,
  PullRequest,
  Repository,
} from "../types/repository.types";

function toQueryString(filters: ListRepositoriesFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.language) params.set("language", filters.language);
  if (filters.sort) params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const repositoriesApi = {
  listAvailable: (orgSlug: string) =>
    apiGet<AvailableRepository[]>(`/organizations/${orgSlug}/github/available-repositories`),
  list: (orgSlug: string, filters: ListRepositoriesFilters) =>
    apiGet<Repository[]>(`/organizations/${orgSlug}/repositories${toQueryString(filters)}`),
  get: (orgSlug: string, repositoryId: string) =>
    apiGet<Repository>(`/organizations/${orgSlug}/repositories/${repositoryId}`),
  import: (orgSlug: string, githubRepoIds: string[]) =>
    apiPost<Repository[]>(`/organizations/${orgSlug}/repositories/import`, { githubRepoIds }),
  remove: (orgSlug: string, repositoryId: string) =>
    apiDelete<{ deleted: boolean }>(`/organizations/${orgSlug}/repositories/${repositoryId}`),
  sync: (orgSlug: string, repositoryId: string) =>
    apiPost<Repository>(`/organizations/${orgSlug}/repositories/${repositoryId}/sync`),
  branches: (orgSlug: string, repositoryId: string) =>
    apiGet<Branch[]>(`/organizations/${orgSlug}/repositories/${repositoryId}/branches`),
  commits: (orgSlug: string, repositoryId: string) =>
    apiGet<Commit[]>(`/organizations/${orgSlug}/repositories/${repositoryId}/commits`),
  contributors: (orgSlug: string, repositoryId: string) =>
    apiGet<Contributor[]>(`/organizations/${orgSlug}/repositories/${repositoryId}/contributors`),
  pullRequests: (orgSlug: string, repositoryId: string) =>
    apiGet<PullRequest[]>(`/organizations/${orgSlug}/repositories/${repositoryId}/pull-requests`),
  issues: (orgSlug: string, repositoryId: string) =>
    apiGet<Issue[]>(`/organizations/${orgSlug}/repositories/${repositoryId}/issues`),
};
