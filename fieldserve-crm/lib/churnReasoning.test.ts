import { describe, expect, it } from "vitest";

import { buildChurnFeatureRows, buildChurnReasoning } from "./churnReasoning";
import type { ChurnScore } from "./hooks/useChurn";

function score(featureSnapshot: ChurnScore["feature_snapshot"]): Pick<ChurnScore, "feature_snapshot" | "risk_bucket"> {
  return {
    risk_bucket: "High",
    feature_snapshot: featureSnapshot,
  };
}

describe("buildChurnReasoning", () => {
  it("surfaces stale activity, missing recent bookings, and cancellations as risk signals", () => {
    const result = buildChurnReasoning(score({
      recency_days: 180,
      freq_3m: 0,
      freq_12m: 1,
      avg_inter_booking_gap: 120,
      cancellation_rate: 0.5,
      monetary_trend: -20,
      unique_item_types: 1,
    }));

    expect(result.reasons.map((reason) => reason.key)).toEqual(
      expect.arrayContaining([
        "recency-high",
        "freq-3m-none",
        "freq-12m-low",
        "gap-long",
        "cancellations-high",
        "spend-trend-down",
        "service-variety-low",
      ]),
    );
    expect(result.reasons.filter((reason) => reason.impact === "risk").length).toBeGreaterThan(4);
  });

  it("surfaces recent repeat activity as protective signals", () => {
    const result = buildChurnReasoning(score({
      recency_days: 10,
      freq_3m: 3,
      freq_12m: 8,
      avg_inter_booking_gap: 21,
      cancellation_rate: 0,
      monetary_trend: 15,
      total_spend_12m: 1200,
      unique_item_types: 4,
    }));

    expect(result.reasons.map((reason) => reason.key)).toEqual(
      expect.arrayContaining([
        "recency-low",
        "freq-3m-repeat",
        "freq-12m-strong",
        "gap-short",
        "cancellations-none",
        "spend-trend-up",
        "service-variety-high",
      ]),
    );
    expect(result.reasons.filter((reason) => reason.impact === "protective").length).toBeGreaterThan(5);
  });

  it("formats missing feature values without throwing", () => {
    const rows = buildChurnFeatureRows({
      recency_days: null,
      freq_3m: undefined,
    });

    expect(rows).toHaveLength(17);
    expect(rows.find((row) => row.key === "recency_days")?.value).toBe("Not enough data");
    expect(rows.find((row) => row.key === "freq_3m")?.value).toBe("Not enough data");
  });

  it("surfaces manual retention adjustments as protective audit signals", () => {
    const result = buildChurnReasoning(score({
      manual_retention_status: "retained",
      manual_retention_note: "Customer confirmed they are happy after a phone call.",
      raw_model_probability: 0.78,
      manual_adjusted_probability: 0.2,
    }));

    expect(result.summary).toContain("manual retention adjustment");
    expect(result.reasons[0]).toMatchObject({
      key: "manual-retention",
      impact: "protective",
      value: "78% -> 20%",
    });
  });
});