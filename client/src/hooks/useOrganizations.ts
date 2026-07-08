import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  organizationsApi,
  type CreateOrganizationPayload,
  type UpdateOrganizationPayload,
} from "../api/organizations.api";

export function useOrganizations() {
  return useQuery({ queryKey: ["organizations"], queryFn: organizationsApi.list });
}

export function useOrganization(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["organizations", orgSlug],
    queryFn: () => organizationsApi.get(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) => organizationsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useUpdateOrganization(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOrganizationPayload) => organizationsApi.update(orgSlug, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", orgSlug] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orgSlug: string) => organizationsApi.remove(orgSlug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
  });
}
