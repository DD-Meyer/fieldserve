import { useMutation, useQuery } from "@tanstack/react-query";

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
};

export type HeatmapInput = {
  grid_size?: number;
  bandwidth?: number | null;
  weight_by?: "count" | "spend";
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

export type ScheduleStop = {
  job_id: number;
  order: number;
  distance_km: number;
  travel_minutes: number;
};

export type ScheduleResponse = {
  total_distance_km: number;
  total_travel_minutes: number;
  stops: ScheduleStop[];
};

export type ScheduleInput = {
  depot: { latitude: number; longitude: number };
  job_ids?: number[];
  average_speed_kmh?: number;
};

export function useOptimiseSchedule() {
  const api = useApi();
  return useMutation<ScheduleResponse, Error, ScheduleInput>({
    mutationFn: (input) =>
      api.post<ScheduleResponse>("/api/analytics/predictions/schedule/", input),
  });
}
