import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi } from "../api/members.api";
import type { OrgRole } from "../types/organization.types";

export function useMembers(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["members", orgSlug],
    queryFn: () => membersApi.list(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useUpdateMemberRole(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) =>
      membersApi.updateRole(orgSlug, memberId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", orgSlug] }),
  });
}

export function useRemoveMember(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => membersApi.remove(orgSlug, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", orgSlug] }),
  });
}
