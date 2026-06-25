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
        ordering: query.ordering,
      }),
    staleTime: 15_000,
    enabled: !!isSignedIn,
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
