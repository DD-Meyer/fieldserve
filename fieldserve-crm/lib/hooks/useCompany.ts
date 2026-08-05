import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../api";

export type CompanyProfile = {
  id: number;
  name: string;
  trading_name: string;
  slug: string;
  tax_id: string;
  email: string;
  phone: string;
  website: string;
  service_area: string;
  premises_address: string;
  registered_address: string;
  logo?: string | null;
  brand_color: string;
  created_at: string;
  updated_at: string;
};

// Generic response type for DRF paginated endpoints
export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export function useCompany() {
  const api = useApi();
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["company"],
    queryFn: () => api.get<PaginatedResponse<CompanyProfile>>("/api/businesses/"),
    // Extract the first company profile cleanly; falls back to undefined if empty
    select: (data): CompanyProfile | undefined => data?.results?.[0],
    staleTime: 30_000,
    enabled: !!isSignedIn,
  });
}

export function useUpdateCompany() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<CompanyProfile>) =>
      api.patch<CompanyProfile>("/api/company/", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}