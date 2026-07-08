import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositoriesApi } from "../api/repositories.api";
import type { ListRepositoriesFilters } from "../types/repository.types";

export function useAvailableRepositories(orgSlug: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["repositories", "available", orgSlug],
    queryFn: () => repositoriesApi.listAvailable(orgSlug!),
    enabled: Boolean(orgSlug) && enabled,
  });
}

export function useRepositories(orgSlug: string | undefined, filters: ListRepositoriesFilters) {
  return useQuery({
    queryKey: ["repositories", orgSlug, filters],
    queryFn: () => repositoriesApi.list(orgSlug!, filters),
    enabled: Boolean(orgSlug),
  });
}

export function useRepository(orgSlug: string | undefined, repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["repositories", orgSlug, repositoryId],
    queryFn: () => repositoriesApi.get(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
  });
}

export function useImportRepositories(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (githubRepoIds: string[]) => repositoriesApi.import(orgSlug, githubRepoIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories", orgSlug] });
      queryClient.invalidateQueries({ queryKey: ["repositories", "available", orgSlug] });
    },
  });
}

export function useRemoveRepository(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) => repositoriesApi.remove(orgSlug, repositoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repositories", orgSlug] }),
  });
}

export function useSyncRepository(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) => repositoriesApi.sync(orgSlug, repositoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repositories", orgSlug] }),
  });
}

export function useBranches(orgSlug: string | undefined, repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["repositories", orgSlug, repositoryId, "branches"],
    queryFn: () => repositoriesApi.branches(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
  });
}

export function useCommits(orgSlug: string | undefined, repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["repositories", orgSlug, repositoryId, "commits"],
    queryFn: () => repositoriesApi.commits(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
  });
}

export function useContributors(orgSlug: string | undefined, repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["repositories", orgSlug, repositoryId, "contributors"],
    queryFn: () => repositoriesApi.contributors(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
  });
}

export function usePullRequests(orgSlug: string | undefined, repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["repositories", orgSlug, repositoryId, "pull-requests"],
    queryFn: () => repositoriesApi.pullRequests(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
  });
}

export function useIssues(orgSlug: string | undefined, repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["repositories", orgSlug, repositoryId, "issues"],
    queryFn: () => repositoriesApi.issues(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
  });
}
