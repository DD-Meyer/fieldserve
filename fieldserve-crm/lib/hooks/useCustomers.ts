import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";

export type Customer = {
  id: number;
  business: number;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  latitude?: number | null;
  longitude?: number | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Customer[];
};

export function useCustomers() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<CustomerPage>("/api/customers/"),
    staleTime: 30_000,
    enabled: !!isSignedIn,
  });
}

export function useCreateCustomer() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Customer>) =>
      api.post<Customer>("/api/customers/", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
