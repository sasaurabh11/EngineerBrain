import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analysisApi } from "../api/analysis.api";
import type { FindingCategory, FindingSeverity } from "../types/analysis.types";

export function useAnalysisStatus(orgSlug: string | undefined, repositoryId: string | undefined) {
  return useQuery({
    queryKey: ["analysis", "status", orgSlug, repositoryId],
    queryFn: () => analysisApi.status(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "RUNNING" ? 3000 : false;
    },
  });
}

export function useLatestAnalysis(orgSlug: string | undefined, repositoryId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["analysis", "latest", orgSlug, repositoryId],
    queryFn: () => analysisApi.latest(orgSlug!, repositoryId!),
    enabled: Boolean(orgSlug) && Boolean(repositoryId) && enabled,
  });
}

export function useFindings(
  orgSlug: string | undefined,
  repositoryId: string | undefined,
  enabled: boolean,
  filters: { category?: FindingCategory; severity?: FindingSeverity } = {},
) {
  return useQuery({
    queryKey: ["analysis", "findings", orgSlug, repositoryId, filters],
    queryFn: () => analysisApi.findings(orgSlug!, repositoryId!, filters),
    enabled: Boolean(orgSlug) && Boolean(repositoryId) && enabled,
  });
}

export function useTriggerAnalysis(orgSlug: string, repositoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => analysisApi.trigger(orgSlug, repositoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["analysis", "status", orgSlug, repositoryId] }),
  });
}
