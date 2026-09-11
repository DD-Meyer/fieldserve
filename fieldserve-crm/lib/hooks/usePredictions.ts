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
  point_count?: number;
  zones?: DemandZone[];
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
