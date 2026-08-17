import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";

export type JobStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Job = {
  id: number;
  business: number;
  customer: number;
  customer_name: string;
  customer_address: string;
  assigned_to: number | null;
  service_type: string;
  notes: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  scheduled_at: string;
  duration_minutes: number | null;
  price: string | number | null;
  status: JobStatus;
  walkaround_complete: boolean;
  walkaround_captured_angles: string[];
  walkaround_missing_angles: string[];
  after_walkaround_complete: boolean;
  after_walkaround_captured_angles: string[];
  after_walkaround_missing_angles: string[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Job[];
};

export type JobQuery = {
  date?: string; // "today" or "YYYY-MM-DD"
  status?: JobStatus;
  assigned_to?: number | "me";
  customer?: number;
  ordering?: string;
};

export function useJobs(query: JobQuery = {}) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["jobs", query],
    queryFn: () =>
      api.get<JobPage>("/api/jobs/", {
        date: query.date,
        status: query.status,
        assigned_to: query.assigned_to as string | number | undefined,
        customer: query.customer,
        ordering: query.ordering,
      }),
    staleTime: 15_000,
    enabled: !!isSignedIn,
  });
}

export function useCustomer(customerId: number | null) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["customer", customerId],
    queryFn: () =>
      api.get<import("./useCustomers").Customer>(
        `/api/customers/${customerId}/`,
      ),
    staleTime: 30_000,
    enabled: !!isSignedIn && customerId != null,
  });
}

export function useCreateJob() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Job>) => api.post<Job>("/api/jobs/", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useJobTransition() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: JobStatus }) =>
      api.post<Job>(`/api/jobs/${id}/transition/`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export type CheckSlotInput = {
  scheduled_at: string;
  duration_minutes: number;
  customer?: number | null;
  business?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  exclude_job_id?: number | null;
};

export type CheckSlotResponse = {
  ok: boolean;
  reason: "outside_hours" | "buffer_conflict" | null;
  suggested_slots: string[];
};

export function useCheckSlot() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: CheckSlotInput) =>
      api.post<CheckSlotResponse>("/api/jobs/check-slot/", input),
  });
}

export type SlotRecommendation = {
  start: string;
  end: string;
  score: number;
  label: "Best fit" | "Good fit" | string;
  previous_job: { id: number; travel_minutes: number } | null;
  next_job: { id: number; travel_minutes: number } | null;
  total_travel_minutes: number;
};

export type SuggestSlotsInput = {
  date: string; // YYYY-MM-DD
  customer: number;
  service?: number;
  duration_minutes?: number;
  exclude_job_id?: number | null;
};

export type SuggestSlotsResponse = {
  date: string;
  recommendations: SlotRecommendation[];
  other_available: string[];
};

export function useSuggestSlots() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: SuggestSlotsInput) =>
      api.post<SuggestSlotsResponse>("/api/jobs/suggest-slots/", input),
  });
}

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RoadRoute = {
  path: RoutePoint[];
  distance_km: number;
  duration_minutes: number;
  legs: { distance_km: number; duration_minutes: number }[];
};

export function useRoadRoute(points: RoutePoint[]) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["road-route", points],
    queryFn: () => api.post<RoadRoute>("/api/jobs/road-route/", { points }),
    enabled: !!isSignedIn && points.length >= 2,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
