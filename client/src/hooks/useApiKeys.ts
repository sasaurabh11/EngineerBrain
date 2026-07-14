import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiKeyApi } from "../api/apiKey.api";

export function useApiKeys(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["apiKeys", orgSlug],
    queryFn: () => apiKeyApi.list(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useCreateApiKey(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiKeyApi.create(orgSlug, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apiKeys", orgSlug] }),
  });
}

export function useRevokeApiKey(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKeyId: string) => apiKeyApi.revoke(orgSlug, apiKeyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apiKeys", orgSlug] }),
  });
}
