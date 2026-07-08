import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { githubApi } from "../api/github.api";

export function useGitHubStatus(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["github-status", orgSlug],
    queryFn: () => githubApi.status(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useConnectGitHub(orgSlug: string) {
  return useMutation({
    mutationFn: () => githubApi.installUrl(orgSlug),
  });
}

export function useDisconnectGitHub(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => githubApi.disconnect(orgSlug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["github-status", orgSlug] }),
  });
}
