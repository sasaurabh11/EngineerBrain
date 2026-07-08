import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitationsApi } from "../api/invitations.api";
import type { OrgRole } from "../types/organization.types";

export function useInvitations(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["invitations", orgSlug],
    queryFn: () => invitationsApi.list(orgSlug!),
    enabled: Boolean(orgSlug),
  });
}

export function useCreateInvitation(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: OrgRole }) => invitationsApi.create(orgSlug, email, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations", orgSlug] }),
  });
}

export function useRevokeInvitation(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.revoke(orgSlug, invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations", orgSlug] }),
  });
}

export function useMyInvitations() {
  return useQuery({ queryKey: ["invitations", "mine"], queryFn: invitationsApi.listMine });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.acceptById(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.declineById(invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations", "mine"] }),
  });
}
