import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";

export type Business = {
  id: number;
  name: string;
  trading_name: string;
  slug: string;
  industry_mode: "mobile" | "fixed";
  email: string;
  phone: string;
  website: string;
  tax_id: string;
  address_line1: string;
  address_city: string;
  address_postcode: string;
  address_country: string;
  brand_color: string;
  logo_url: string;
  working_hours_start: string; // "HH:MM:SS"
  working_hours_end: string;
  default_travel_buffer_minutes: number;
  depot_latitude: number | null;
  depot_longitude: number | null;
  role: string | null;
};

export type BusinessUpdate = Partial<
  Pick<
    Business,
    | "name"
    | "trading_name"
    | "industry_mode"
    | "email"
    | "phone"
    | "website"
    | "tax_id"
    | "address_line1"
    | "address_city"
    | "address_postcode"
    | "address_country"
    | "brand_color"
    | "working_hours_start"
    | "working_hours_end"
    | "default_travel_buffer_minutes"
    | "depot_latitude"
    | "depot_longitude"
  >
>;

export function useCurrentBusiness() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["business", "current"],
    queryFn: () => api.get<Business>("/api/businesses/current/"),
    staleTime: 60_000,
    enabled: !!isSignedIn,
  });
}

export function useUpdateBusiness() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: BusinessUpdate }) =>
      api.patch<Business>(`/api/businesses/${id}/`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business"] }),
  });
}
