import axios, { type AxiosError } from "axios";

type GetTokenFn = () => Promise<string | null>;

export const tokenProvider: { getToken: GetTokenFn | null } = { getToken: null };

interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ApiErrorEnvelope {
  success: false;
  error: { message: string; code: string };
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenProvider.getToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorEnvelope>) => {
    const message = error.response?.data?.error?.message ?? error.message ?? "Something went wrong";
    return Promise.reject(new Error(message));
  },
);

export async function apiGet<T>(url: string): Promise<T> {
  const { data } = await apiClient.get<ApiSuccessEnvelope<T>>(url);
  return data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.post<ApiSuccessEnvelope<T>>(url, body);
  return data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.patch<ApiSuccessEnvelope<T>>(url, body);
  return data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const { data } = await apiClient.delete<ApiSuccessEnvelope<T>>(url);
  return data.data;
}
