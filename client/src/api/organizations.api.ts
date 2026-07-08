import { apiDelete, apiGet, apiPatch, apiPost } from "./axiosClient";
import type { Organization } from "../types/organization.types";

export interface CreateOrganizationPayload {
  name: string;
  description?: string;
  logoUrl?: string;
}

export interface UpdateOrganizationPayload {
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
}

export const organizationsApi = {
  list: () => apiGet<Organization[]>("/organizations"),
  create: (payload: CreateOrganizationPayload) => apiPost<Organization>("/organizations", payload),
  get: (orgSlug: string) => apiGet<Organization>(`/organizations/${orgSlug}`),
  update: (orgSlug: string, payload: UpdateOrganizationPayload) =>
    apiPatch<Organization>(`/organizations/${orgSlug}`, payload),
  remove: (orgSlug: string) => apiDelete<{ deleted: boolean }>(`/organizations/${orgSlug}`),
};
