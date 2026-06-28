import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";

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
}>;

export type ChurnRiskBucket = "Low" | "Medium" | "High";

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
