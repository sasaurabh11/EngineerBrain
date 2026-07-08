import { apiGet, apiPost } from "./axiosClient";
import type { GitHubStatus } from "../types/github.types";

export const githubApi = {
  status: (orgSlug: string) => apiGet<GitHubStatus>(`/organizations/${orgSlug}/github/status`),
  installUrl: (orgSlug: string) => apiGet<{ url: string }>(`/organizations/${orgSlug}/github/install-url`),
  disconnect: (orgSlug: string) => apiPost<{ disconnected: boolean }>(`/organizations/${orgSlug}/github/disconnect`),
};
