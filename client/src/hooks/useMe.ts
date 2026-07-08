import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userApi } from "../api/user.api";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: userApi.getMe });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => userApi.updateMe(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}
