import { apiDelete, apiGet, apiPost } from "./axiosClient";
import type { Invitation } from "../types/invitation.types";
import type { OrgRole } from "../types/organization.types";

export const invitationsApi = {
  list: (orgSlug: string) => apiGet<Invitation[]>(`/organizations/${orgSlug}/invitations`),
  create: (orgSlug: string, email: string, role: OrgRole) =>
    apiPost<Invitation>(`/organizations/${orgSlug}/invitations`, { email, role }),
  revoke: (orgSlug: string, invitationId: string) =>
    apiDelete<{ revoked: boolean }>(`/organizations/${orgSlug}/invitations/${invitationId}`),
  accept: (token: string) => apiPost<{ organizationId: string }>(`/invitations/${token}/accept`),
  listMine: () => apiGet<Invitation[]>("/invitations/me"),
  acceptById: (invitationId: string) =>
    apiPost<{ organizationId: string }>(`/invitations/me/${invitationId}/accept`),
  declineById: (invitationId: string) =>
    apiPost<{ declined: boolean }>(`/invitations/me/${invitationId}/decline`),
};
