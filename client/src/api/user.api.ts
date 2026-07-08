import { apiGet, apiPatch } from "./axiosClient";
import type { UserProfile } from "../types/user.types";

export const userApi = {
  getMe: () => apiGet<UserProfile>("/me"),
  updateMe: (name: string) => apiPatch<UserProfile>("/me", { name }),
};
