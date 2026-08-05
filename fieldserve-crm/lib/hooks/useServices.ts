import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";
import type { PaginatedResponse } from "./useCompany";

export type Service = {
  id: number;
  business: number;
  name: string;
  slug: string;
  description: string;
  duration_minutes: number;
  price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServiceInput = {
  name: string;
  description?: string;
  duration_minutes: number;
  price: number | string;
  is_active?: boolean;
};

export function useServices() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["services"],
    queryFn: () =>
      api.get<PaginatedResponse<Service>>("/api/services/", {
        ordering: "name",
      }),
    staleTime: 30_000,
    enabled: !!isSignedIn,
  });
}

export function useCreateService() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ServiceInput) =>
      api.post<Service>("/api/services/", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useUpdateService() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ServiceInput> }) =>
      api.patch<Service>(`/api/services/${id}/`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useDeleteService() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/api/services/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}
