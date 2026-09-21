import { HIGH_RISK_THRESHOLD, MEDIUM_RISK_THRESHOLD } from "./churnRisk";
import type { ChurnScore } from "./hooks/useChurn";
import type { Customer } from "./hooks/useCustomers";
import type { Job, RoadRoute } from "./hooks/useJobs";
import type { DemandZone, HeatmapResponse, OpportunityZone } from "./hooks/usePredictions";
import type { Inspection } from "./hooks/useInspections";
import type { Service } from "./hooks/useServices";

export type ChartPoint = { label: string; value: number };
export type BreakdownItem = { label: string; value: number; color?: string };

export type ChurnInsights = {
  scoredCustomers: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  unscored: number;
  averageProbability: number;
  revenueAtRisk: number;
  trend: ChartPoint[];
  topCustomers: { id: number; name: string; probability: number; reason: string; exposure: number }[];
  reasoning: string;
};

export type DemandInsights = {
  pointCount: number;
  strongestZone: string;
  opportunityRevenue: number;
  serviceSuggestions: { name: string; bookings: number; estimatedRevenue: number; reason: string }[];
  zones: { name: string; score: number; detail: string }[];
  reasoning: string;
};

export type InspectionInsights = {
  inspections: number;
  completed: number;
  totalDamages: number;
  averageConfidence: number;
  byType: BreakdownItem[];
  byRegion: BreakdownItem[];
  byConfidence: BreakdownItem[];
  reasoning: string;
};

export type SchedulerInsights = {
  jobCount: number;
  usualMinutes: number;
  optimizedMinutes: number;
  minutesSaved: number;
  percentSaved: number;
  usualDistanceKm: number;
  optimizedDistanceKm: number;
  excludedJobs: number;
  reasoning: string;
};

function finite(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function moneyFromJob(job: Job): number {
  return finite(job.price);
}

function riskReason(score: ChurnScore): string {
  const snap = score.feature_snapshot ?? {};
  const reasons: string[] = [];
  if (finite(snap.recency_days) >= 90) reasons.push(`${Math.round(finite(snap.recency_days))} days since last booking`);
  if (finite(snap.freq_3m) === 0) reasons.push("no bookings in the last 3 months");
  if (finite(snap.cancellation_rate) >= 0.25) reasons.push(`${Math.round(finite(snap.cancellation_rate) * 100)}% cancellation rate`);
  if (finite(snap.monetary_trend) < 0) reasons.push("recent spend is trending down");
  return reasons.slice(0, 2).join("; ") || `${score.risk_bucket.toLowerCase()} model bucket`;
}

export function buildChurnInsights(
  scores: ChurnScore[],
  customers: Customer[],
): ChurnInsights {
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.full_name]));
  const scoredIds = new Set(scores.map((score) => score.customer));
  const highRisk = scores.filter((score) => score.risk_bucket === "High").length;
  const mediumRisk = scores.filter((score) => score.risk_bucket === "Medium").length;
  const lowRisk = scores.filter((score) => score.risk_bucket === "Low").length;
  const probabilities = scores.map((score) => finite(score.probability));
  const highRiskScores = scores.filter((score) => finite(score.probability) >= HIGH_RISK_THRESHOLD);
  const revenueAtRisk = sum(
    highRiskScores.map((score) => finite(score.feature_snapshot?.total_spend_12m) * finite(score.probability)),
  );

  const sorted = [...scores].sort((a, b) => finite(b.probability) - finite(a.probability));

  return {
    scoredCustomers: scores.length,
    highRisk,
    mediumRisk,
    lowRisk,
    unscored: Math.max(0, customers.length - scoredIds.size),
    averageProbability: probabilities.length ? round(sum(probabilities) / probabilities.length, 3) : 0,
    revenueAtRisk: round(revenueAtRisk),
    trend: [
      { label: "Low", value: lowRisk },
      { label: "Medium", value: mediumRisk },
      { label: "High", value: highRisk },
    ],
    topCustomers: sorted.slice(0, 5).map((score) => ({
      id: score.customer,
      name: customerNames.get(score.customer) ?? score.customer_name ?? `Customer #${score.customer}`,
      probability: finite(score.probability),
      reason: riskReason(score),
      exposure: round(finite(score.feature_snapshot?.total_spend_12m) * finite(score.probability)),
    })),
    reasoning: scores.length
      ? `${highRisk} customers are above the ${Math.round(HIGH_RISK_THRESHOLD * 100)}% high-risk threshold and ${mediumRisk} sit in the watchlist band above ${Math.round(MEDIUM_RISK_THRESHOLD * 100)}%.`
      : "No churn scores are available yet. Run churn scoring after customers have booking history.",
  };
}

function zoneScore(zone: DemandZone | OpportunityZone): number {
  if ("opportunity_score" in zone) return finite(zone.opportunity_score);
  return Math.max(finite(zone.share_pct) / 100, finite(zone.delta_pct) / 100, finite(zone.booking_count) / 100);
}

function servicePrice(name: string, services: Service[], jobs: Job[]): number {
  const service = services.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (service) return finite(service.price);
  const matchingJobs = jobs.filter((job) => job.service_type.toLowerCase() === name.toLowerCase());
  const values = matchingJobs.map(moneyFromJob).filter((value) => value > 0);
  return values.length ? sum(values) / values.length : 0;
}

export function buildDemandInsights(
  heatmap: HeatmapResponse | undefined,
  services: Service[],
  jobs: Job[],
): DemandInsights {
  const latest = heatmap;
  const zones = latest?.zones ?? [];
  const opportunityZones = latest?.opportunity_zones ?? [];
  const activeNames = new Set(services.filter((service) => service.is_active).map((service) => service.name.toLowerCase()));
  const serviceDemand = new Map<string, number>();

  zones.forEach((zone) => {
    zone.service_mix.forEach((service) => {
      serviceDemand.set(service.name, (serviceDemand.get(service.name) ?? 0) + service.bookings);
    });
  });

  const serviceSuggestions = [...serviceDemand.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, bookings]) => {
      const estimatedRevenue = round(bookings * servicePrice(name, services, jobs));
      const covered = activeNames.has(name.toLowerCase());
      return {
        name,
        bookings,
        estimatedRevenue,
        reason: covered
          ? "Already in the catalogue; promote it in the strongest demand zones."
          : "Demand appears in local booking history but this service is not active in the catalogue.",
      };
    });

  const rankedZones = [...zones, ...opportunityZones]
    .sort((a, b) => zoneScore(b) - zoneScore(a))
    .slice(0, 5)
    .map((zone) => ({
      name: zone.name,
      score: round(zoneScore(zone), 3),
      detail: "customer_signal" in zone
        ? zone.customer_signal
        : `${Math.round(finite(zone.estimated_demand_share) * 100)}% estimated demand share`,
    }));

  return {
    pointCount: finite(latest?.point_count ?? latest?.input_point_count),
    strongestZone: rankedZones[0]?.name ?? "No zone yet",
    opportunityRevenue: round(sum(serviceSuggestions.map((suggestion) => suggestion.estimatedRevenue))),
    serviceSuggestions,
    zones: rankedZones,
    reasoning: latest
      ? `${finite(latest.point_count ?? latest.input_point_count)} all-time customer locations are feeding the demand model, with ${rankedZones.length} ranked opportunity zones.`
      : "Not enough customer location data is available to generate demand zones yet.",
  };
}

function confidenceBand(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

function toBreakdown(record: Record<string, number>, colors: Record<string, string> = {}): BreakdownItem[] {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label: label.replaceAll("_", " "), value, color: colors[label] }));
}

export function buildInspectionInsights(inspections: Inspection[]): InspectionInsights {
  const completed = inspections.filter((inspection) => inspection.analysis_status === "done");
  const damages = completed.flatMap((inspection) => inspection.analysis?.damages ?? []);
  const typeCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  const confidenceCounts: Record<string, number> = { high: 0, medium: 0, low: 0 };

  damages.forEach((damage) => {
    typeCounts[damage.label] = (typeCounts[damage.label] ?? 0) + 1;
    const region = damage.region ?? "unspecified";
    regionCounts[region] = (regionCounts[region] ?? 0) + 1;
    const band = damage.confidence_band ?? confidenceBand(finite(damage.confidence));
    confidenceCounts[band] = (confidenceCounts[band] ?? 0) + 1;
  });

  return {
    inspections: inspections.length,
    completed: completed.length,
    totalDamages: damages.length,
    averageConfidence: damages.length ? round(sum(damages.map((damage) => finite(damage.confidence))) / damages.length, 3) : 0,
    byType: toBreakdown(typeCounts),
    byRegion: toBreakdown(regionCounts),
    byConfidence: toBreakdown(confidenceCounts, { high: "#16a34a", medium: "#d97706", low: "#dc2626" }),
    reasoning: damages.length
      ? `${damages.length} detected issues were found across ${completed.length} completed inspection analyses.`
      : "No completed inspection damage detections are available yet.",
  };
}

export type OptimizedScheduleLike = {
  stops?: unknown[];
  total_distance_km?: number;
  total_travel_minutes?: number;
};

export function buildSchedulerInsights(
  jobs: Job[],
  usualRoute?: RoadRoute,
  optimized?: OptimizedScheduleLike,
): SchedulerInsights {
  const locatedJobs = jobs.filter((job) => typeof job.latitude === "number" && typeof job.longitude === "number");
  const usualMinutes = finite(usualRoute?.duration_minutes);
  const optimizedMinutes = finite(optimized?.total_travel_minutes);
  const rawSavings = usualMinutes - optimizedMinutes;
  const minutesSaved = usualMinutes > 0 && optimizedMinutes > 0 ? Math.max(0, rawSavings) : 0;

  return {
    jobCount: locatedJobs.length,
    usualMinutes: round(usualMinutes),
    optimizedMinutes: round(optimizedMinutes),
    minutesSaved: round(minutesSaved),
    percentSaved: usualMinutes > 0 ? round(minutesSaved / usualMinutes, 3) : 0,
    usualDistanceKm: round(finite(usualRoute?.distance_km), 1),
    optimizedDistanceKm: round(finite(optimized?.total_distance_km), 1),
    excludedJobs: Math.max(0, jobs.length - locatedJobs.length),
    reasoning: minutesSaved > 0
      ? `Across the loaded booking history, the optimizer saves ${Math.round(minutesSaved)} minutes compared with the usual scheduled-order route.`
      : "All-time smart scheduler savings need at least two located jobs plus an optimized route response.",
  };
}
