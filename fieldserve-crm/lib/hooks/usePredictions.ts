import { useQuery } from "@tanstack/react-query";

import { useApi } from "../api";
import type { RoutePoint } from "./useJobs";

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

export type OptimizedScheduleStop = {
  job_id?: number;
  id?: number;
  latitude?: number;
  longitude?: number;
  service_type?: string;
  order?: number;
  distance_km?: number;
  travel_minutes?: number;
};

export type OptimizedScheduleResponse = {
  stops: OptimizedScheduleStop[];
  total_distance_km: number;
  total_travel_minutes: number;
};

export type OptimizedScheduleInput = {
  depot: RoutePoint | null;
  job_ids?: number[];
  average_speed_kmh?: number;
};

export function useOptimizedSchedule(input: OptimizedScheduleInput) {
  const api = useApi();
  const jobIds = input.job_ids ?? [];
  return useQuery<OptimizedScheduleResponse>({
    queryKey: ["predictions", "schedule", input.depot, jobIds, input.average_speed_kmh],
    queryFn: () =>
      api.post<OptimizedScheduleResponse>("/api/analytics/predictions/schedule/", {
        depot: input.depot,
        job_ids: jobIds,
        average_speed_kmh: input.average_speed_kmh ?? 40,
      }),
    enabled: !!input.depot && jobIds.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
