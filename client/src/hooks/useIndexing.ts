import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { indexingApi } from "../api/indexing.api";

export function useIndexStatus(orgSlug: string | undefined, repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["indexing", "status", orgSlug, repositoryId],
    queryFn: () => indexingApi.status(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
    refetchInterval: (query) => (query.state.data?.status === "INDEXING" ? 3000 : false),
  });
}

export function useTriggerIndex(orgSlug: string, repositoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => indexingApi.trigger(orgSlug, repositoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["indexing", "status", orgSlug, repositoryId] }),
  });
}

export function useReindex(orgSlug: string, repositoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => indexingApi.reindex(orgSlug, repositoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["indexing", "status", orgSlug, repositoryId] }),
  });
}
