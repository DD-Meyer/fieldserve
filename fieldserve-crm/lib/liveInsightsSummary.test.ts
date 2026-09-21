import { describe, expect, it } from "vitest";

import {
  buildChurnInsights,
  buildDemandInsights,
  buildInspectionInsights,
  buildSchedulerInsights,
} from "./liveInsightsSummary";
import type { ChurnScore } from "./hooks/useChurn";
import type { Customer } from "./hooks/useCustomers";
import type { Inspection } from "./hooks/useInspections";
import type { Job, RoadRoute } from "./hooks/useJobs";
import type { Service } from "./hooks/useServices";

const customer = (id: number, full_name: string): Customer => ({
  id,
  full_name,
  business: 1,
  email: "",
  phone: "",
  address: "",
  notes: "",
  last_seen_at: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
});

const score = (
  customerId: number,
  probability: number,
  risk_bucket: ChurnScore["risk_bucket"],
  spend: number,
): ChurnScore => ({
  id: customerId,
  customer: customerId,
  customer_name: `Customer ${customerId}`,
  probability: String(probability),
  risk_bucket,
  scored_at: "2026-09-21T00:00:00Z",
  model_version: "v1",
  model_name: "test",
  feature_set: "extended",
  created_at: "2026-09-21T00:00:00Z",
  feature_snapshot: {
    recency_days: 120,
    freq_3m: 0,
    total_spend_12m: spend,
  },
});

const job = (id: number, price: number, service_type = "Detailing"): Job => ({
  id,
  business: 1,
  customer: 1,
  customer_name: "A",
  customer_address: "",
  assigned_to: null,
  service_type,
  notes: "",
  address: "",
  latitude: 51 + id / 100,
  longitude: -0.1,
  scheduled_at: "2026-09-21T09:00:00Z",
  duration_minutes: 60,
  price,
  status: "scheduled",
  walkaround_complete: false,
  walkaround_captured_angles: [],
  walkaround_missing_angles: [],
  after_walkaround_complete: false,
  after_walkaround_captured_angles: [],
  after_walkaround_missing_angles: [],
  completed_at: null,
  created_at: "2026-09-21T00:00:00Z",
  updated_at: "2026-09-21T00:00:00Z",
});

describe("live insights summaries", () => {
  it("builds churn cohorts and revenue exposure from live score shapes", () => {
    const result = buildChurnInsights(
      [score(1, 0.8, "High", 1000), score(2, 0.4, "Medium", 500)],
      [customer(1, "Ada"), customer(2, "Ben"), customer(3, "Cal")],
    );

    expect(result.highRisk).toBe(1);
    expect(result.mediumRisk).toBe(1);
    expect(result.unscored).toBe(1);
    expect(result.revenueAtRisk).toBe(800);
    expect(result.topCustomers[0].name).toBe("Ada");
  });

  it("derives service opportunity from demand zones and service prices", () => {
    const services: Service[] = [{
      id: 1,
      business: 1,
      name: "Detailing",
      slug: "detailing",
      description: "",
      duration_minutes: 60,
      price: "120",
      is_active: true,
      created_at: "",
      updated_at: "",
    }];

    const result = buildDemandInsights({
      cells: [],
      bounds: {},
      point_count: 8,
      zones: [{
        id: 1,
        name: "North",
        latitude: 51,
        longitude: -0.1,
        customer_count: 4,
        booking_count: 6,
        share_pct: 60,
        density: "high",
        delta_pct: 20,
        customer_signal: "Repeat demand",
        service_mix: [{ name: "Detailing", bookings: 3 }],
      }],
    }, services, []);

    expect(result.strongestZone).toBe("North");
    expect(result.opportunityRevenue).toBe(360);
    expect(result.serviceSuggestions[0].reason).toContain("catalogue");
    expect(result.reasoning).toContain("all-time customer locations");
  });

  it("aggregates inspection damage by type, region, and confidence", () => {
    const inspection: Inspection = {
      id: 1,
      job: 1,
      phase: "before",
      angle: "front",
      photo_url: null,
      analysis_status: "done",
      analysis_error: "",
      damage_count: 2,
      created_at: "",
      updated_at: "",
      analysis: {
        damages: [
          { label: "scratch", confidence: 0.8, confidence_band: "high", region: "front", bbox: [0, 0, 1, 1] },
          { label: "dent", confidence: 0.55, confidence_band: "medium", region: "door", bbox: [0, 0, 1, 1] },
        ],
      },
    };

    const result = buildInspectionInsights([inspection]);

    expect(result.totalDamages).toBe(2);
    expect(result.byType.map((item) => item.label)).toContain("scratch");
    expect(result.byConfidence.find((item) => item.label === "high")?.value).toBe(1);
  });

  it("compares usual route minutes with optimized route minutes", () => {
    const route: RoadRoute = {
      path: [],
      distance_km: 42,
      duration_minutes: 120,
      legs: [],
    };

    const result = buildSchedulerInsights(
      [job(1, 100), job(2, 150)],
      route,
      { total_distance_km: 30, total_travel_minutes: 75, stops: [] },
    );

    expect(result.minutesSaved).toBe(45);
    expect(result.percentSaved).toBe(0.375);
    expect(result.usualDistanceKm).toBe(42);
    expect(result.reasoning).toContain("loaded booking history");
  });
});
