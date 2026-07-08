import { apiDelete, apiGet, apiPatch } from "./axiosClient";
import type { Member } from "../types/member.types";
import type { OrgRole } from "../types/organization.types";

export const membersApi = {
  list: (orgSlug: string) => apiGet<Member[]>(`/organizations/${orgSlug}/members`),
  updateRole: (orgSlug: string, memberId: string, role: OrgRole) =>
    apiPatch<Member>(`/organizations/${orgSlug}/members/${memberId}`, { role }),
  remove: (orgSlug: string, memberId: string) =>
    apiDelete<{ deleted: boolean }>(`/organizations/${orgSlug}/members/${memberId}`),
};
