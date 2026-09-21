import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";

export type ChurnFeatureSnapshot = Partial<{
  recency_days: number | null;
  tenure_days: number | null;
  freq_12m: number | null;
  freq_3m: number | null;
  avg_inter_booking_gap: number | null;
  inter_booking_gap_std: number | null;
  total_spend_12m: number | null;
  avg_ticket: number | null;
  monetary_trend: number | null;
  spend_per_visit_std: number | null;
  spend_per_visit_cv: number | null;
  cancellation_rate: number | null;
  unique_item_types: number | null;
  total_units: number | null;
  weekend_share: number | null;
  evening_share: number | null;
  is_uk: number | null;
  manual_retention_signal_id: number | null;
  manual_retention_status: CustomerRetentionStatus | null;
  manual_retention_note: string | null;
  manual_retention_created_at: string | null;
  raw_model_probability: number | null;
  manual_adjusted_probability: number | null;
  manual_adjustment_reason: string | null;
}>;

export type ChurnRiskBucket = "Low" | "Medium" | "High";
export type CustomerRetentionStatus = "retained" | "reassured" | "watchlist";

export type ChurnScore = {
  id: number;
  customer: number;
  customer_name: string;
  scored_at: string;
  probability: string; // DRF decimal serialized as string
  risk_bucket: ChurnRiskBucket;
  model_version: string;
  model_name: string;
  feature_set: string;
  feature_snapshot: ChurnFeatureSnapshot;
  created_at: string;
};

export type ChurnScorePage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ChurnScore[];
};

export type CustomerRetentionSignal = {
  id: number;
  customer: number;
  customer_name: string;
  created_by: number | null;
  created_by_email: string | null;
  source_score: number | null;
  status: CustomerRetentionStatus;
  note: string;
  expires_at: string | null;
  created_at: string;
};

export type MarkCustomerRetainedInput = {
  customerId: number;
  status: CustomerRetentionStatus;
  note: string;
  expires_days?: number;
};

export type MarkCustomerRetainedResponse = {
  signal: CustomerRetentionSignal;
  score: ChurnScore | null;
};

export function useChurnScores() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["churn-scores"],
    queryFn: () =>
      api.get<ChurnScorePage>("/api/analytics/churn/scores/", {
        ordering: "-scored_at",
      }),
    staleTime: 30_000,
    enabled: !!isSignedIn,
  });
}

export function useLatestChurnScore(customerId: number | null) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["churn-score", customerId],
    queryFn: () =>
      api.get<ChurnScorePage>("/api/analytics/churn/scores/", {
        customer: customerId ?? undefined,
        ordering: "-scored_at",
      }),
    staleTime: 30_000,
    enabled: !!isSignedIn && customerId != null,
  });
}

export function useChurnHistory(customerId: number | null) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["churn-history", customerId],
    queryFn: () =>
      api.get<ChurnScore[]>(
        `/api/analytics/churn/scores/history/${customerId}/`,
      ),
    staleTime: 30_000,
    enabled: !!isSignedIn && customerId != null,
  });
}

export function useMarkCustomerRetained() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, status, note, expires_days }: MarkCustomerRetainedInput) =>
      api.post<MarkCustomerRetainedResponse>(
        `/api/analytics/churn/scores/retain/${customerId}/`,
        { status, note, expires_days },
      ),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["churn-scores"] });
      qc.invalidateQueries({ queryKey: ["churn-score", variables.customerId] });
      qc.invalidateQueries({ queryKey: ["churn-history", variables.customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", variables.customerId] });
    },
  });
}
