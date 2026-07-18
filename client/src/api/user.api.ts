import { apiGet, apiPatch } from "./axiosClient";
import type { UpdateAiSettingsInput, UserProfile } from "../types/user.types";

export const userApi = {
  getMe: () => apiGet<UserProfile>("/me"),
  updateMe: (name: string) => apiPatch<UserProfile>("/me", { name }),
  updateAiSettings: (input: UpdateAiSettingsInput) => apiPatch<UserProfile>("/me/ai-settings", input),
};
