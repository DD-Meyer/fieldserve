import { useQuery } from "@tanstack/react-query";

import { useApi } from "../api";

export type HeatmapCell = {
  latitude: number;
  longitude: number;
  intensity: number;
};

export type HeatmapBounds = {
  lat_min: number;
  lat_max: number;
  lng_min: number;
  lng_max: number;
};

export type HeatmapResponse = {
  cells: HeatmapCell[];
  bounds: HeatmapBounds | Record<string, never>;
  computation_mode?: "live_request_kde" | "forecast_kde_bundle";
  input_point_count?: number;
  point_count?: number;
  computed_at?: string;
  source_as_of?: string;
  zones?: DemandZone[];
  forecast_horizon_days?: number;
  model_version?: string;
  metrics?: Record<string, number>;
  opportunity_zones?: OpportunityZone[];
};

export type OpportunityZone = {
  id: string | number;
  name: string;
  latitude: number;
  longitude: number;
  opportunity_score: number;
  estimated_demand_share: number;
  confidence_band: "high" | "medium" | "low";
};

export type DemandZoneService = {
  name: string;
  bookings: number;
};

export type DemandZone = {
  id: string | number;
  name: string;
  latitude: number;
  longitude: number;
  customer_count: number;
  booking_count: number;
  share_pct: number;
  density: "high" | "medium" | "low";
  delta_pct: number;
  service_mix: DemandZoneService[];
  customer_signal: string;
};

export type HeatmapInput = {
  grid_size?: number;
  bandwidth?: number | null;
  weight_by?: "count" | "spend";
  range?: "all" | "30d" | "90d" | "weekends" | "new";
  mode?: "live" | "forecast";
  forecast_horizon_days?: number;
};

export function useHeatmap(input: HeatmapInput = {}) {
  const api = useApi();
  return useQuery<HeatmapResponse>({
    queryKey: ["predictions", "heatmap", input],
    queryFn: () =>
      api.post<HeatmapResponse>("/api/analytics/predictions/heatmap/", input),
    staleTime: 5 * 60 * 1000,
  });
}
