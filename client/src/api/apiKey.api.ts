import { apiDelete, apiGet, apiPost } from "./axiosClient";
import type { ApiKey, CreatedApiKey } from "../types/apiKey.types";

export const apiKeyApi = {
  list: (orgSlug: string) => apiGet<ApiKey[]>(`/organizations/${orgSlug}/api-keys`),
  create: (orgSlug: string, name: string) => apiPost<CreatedApiKey>(`/organizations/${orgSlug}/api-keys`, { name }),
  revoke: (orgSlug: string, apiKeyId: string) =>
    apiDelete<{ revoked: boolean }>(`/organizations/${orgSlug}/api-keys/${apiKeyId}`),
};
