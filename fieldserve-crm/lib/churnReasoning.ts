import type { ChurnFeatureSnapshot, ChurnScore } from "./hooks/useChurn";

export type ChurnSignalImpact = "risk" | "protective" | "neutral";

export type ChurnFeatureKey = keyof ChurnFeatureSnapshot;

export type ChurnFeatureRow = {
  key: ChurnFeatureKey;
  label: string;
  description: string;
  value: string;
  rawValue: number | null | undefined;
};

export type ChurnReason = {
  key: string;
  title: string;
  detail: string;
  value: string;
  impact: ChurnSignalImpact;
};

export type ChurnReasoning = {
  summary: string;
  reasons: ChurnReason[];
  featureRows: ChurnFeatureRow[];
};

type Formatter = (value: number | null | undefined) => string;

type FeatureMeta = {
  key: ChurnFeatureKey;
  label: string;
  description: string;
  format: Formatter;
};

const missing = "Not enough data";

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (!isNumber(value)) return missing;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function formatDays(value: number | null | undefined): string {
  if (!isNumber(value)) return missing;
  const days = Math.round(value);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatCurrency(value: number | null | undefined): string {
  if (!isNumber(value)) return missing;
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number | null | undefined): string {
  if (!isNumber(value)) return missing;
  return `${Math.round(value * 100)}%`;
}

function formatTrend(value: number | null | undefined): string {
  if (!isNumber(value)) return missing;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)} per recent booking`;
}

function formatBooleanFlag(value: number | null | undefined): string {
  if (!isNumber(value)) return missing;
  return value >= 1 ? "Yes" : "No";
}

export const CHURN_FEATURES: FeatureMeta[] = [
  {
    key: "recency_days",
    label: "Days since last booking",
    description: "Days since the customer's most recent booking at scoring time.",
    format: formatDays,
  },
  {
    key: "tenure_days",
    label: "Customer tenure",
    description: "Days since the customer's first booking.",
    format: formatDays,
  },
  {
    key: "freq_12m",
    label: "Bookings in last 12 months",
    description: "Number of bookings in the last 12 months.",
    format: (value) => formatNumber(value),
  },
  {
    key: "freq_3m",
    label: "Bookings in last 3 months",
    description: "Number of bookings in the last 3 months.",
    format: (value) => formatNumber(value),
  },
  {
    key: "avg_inter_booking_gap",
    label: "Average booking gap",
    description: "Mean gap in days between consecutive bookings.",
    format: formatDays,
  },
  {
    key: "inter_booking_gap_std",
    label: "Booking gap variation",
    description: "How much the gap between bookings varies.",
    format: formatDays,
  },
  {
    key: "total_spend_12m",
    label: "Spend in last 12 months",
    description: "Total invoice value over the last 12 months.",
    format: formatCurrency,
  },
  {
    key: "avg_ticket",
    label: "Average booking value",
    description: "Mean invoice value per booking.",
    format: formatCurrency,
  },
  {
    key: "monetary_trend",
    label: "Recent spend trend",
    description: "Slope through the most recent booking values.",
    format: formatTrend,
  },
  {
    key: "spend_per_visit_std",
    label: "Spend variation",
    description: "Standard deviation of spend per booking.",
    format: formatCurrency,
  },
  {
    key: "spend_per_visit_cv",
    label: "Spend volatility",
    description: "Coefficient of variation for spend per booking.",
    format: (value) => formatNumber(value, 2),
  },
  {
    key: "cancellation_rate",
    label: "Cancellation rate",
    description: "Fraction of bookings cancelled in the observation window.",
    format: formatPercent,
  },
  {
    key: "unique_item_types",
    label: "Service variety",
    description: "Number of distinct services booked in the observation window.",
    format: (value) => formatNumber(value),
  },
  {
    key: "total_units",
    label: "Total service volume",
    description: "Total booked units or duration proxy across observed bookings.",
    format: (value) => formatNumber(value),
  },
  {
    key: "weekend_share",
    label: "Weekend share",
    description: "Share of bookings made on Saturday or Sunday.",
    format: formatPercent,
  },
  {
    key: "evening_share",
    label: "Evening share",
    description: "Share of bookings scheduled from 5pm onward.",
    format: formatPercent,
  },
  {
    key: "is_uk",
    label: "UK-based customer",
    description: "Whether the address appears to be UK-based.",
    format: formatBooleanFlag,
  },
];

export function buildChurnFeatureRows(
  snapshot: ChurnFeatureSnapshot | undefined,
): ChurnFeatureRow[] {
  return CHURN_FEATURES.map((feature): ChurnFeatureRow => {
    const rawValue = snapshot?.[feature.key];
    const numericValue: number | null | undefined =
      typeof rawValue === "number" ? rawValue : rawValue == null ? rawValue : undefined;
    return {
      key: feature.key,
      label: feature.label,
      description: feature.description,
      rawValue: numericValue,
      value: feature.format(numericValue),
    };
  });
}

function reason(
  key: string,
  title: string,
  detail: string,
  value: string,
  impact: ChurnSignalImpact,
): ChurnReason {
  return { key, title, detail, value, impact };
}

function buildReasons(snapshot: ChurnFeatureSnapshot): ChurnReason[] {
  const reasons: ChurnReason[] = [];
  if (snapshot.manual_retention_status) {
    const raw = snapshot.raw_model_probability;
    const adjusted = snapshot.manual_adjusted_probability;
    const value = isNumber(raw) && isNumber(adjusted)
      ? `${Math.round(raw * 100)}% → ${Math.round(adjusted * 100)}%`
      : snapshot.manual_retention_status.replace("_", " ");
    reasons.push(reason(
      "manual-retention",
      "Customer manually reassured",
      snapshot.manual_retention_note
        ? `A team member recorded: ${snapshot.manual_retention_note}`
        : "A team member recorded a retention contact for this customer.",
      value,
      "protective",
    ));
  }
  const recency = snapshot.recency_days;
  const freq3m = snapshot.freq_3m;
  const freq12m = snapshot.freq_12m;
  const gap = snapshot.avg_inter_booking_gap;
  const cancellationRate = snapshot.cancellation_rate;
  const spendTrend = snapshot.monetary_trend;
  const totalSpend = snapshot.total_spend_12m;
  const serviceVariety = snapshot.unique_item_types;
  const tenure = snapshot.tenure_days;

  if (isNumber(recency)) {
    if (recency >= 120) {
      reasons.push(reason(
        "recency-high",
        "Long time since last booking",
        "The customer has not booked recently, which is one of the clearest churn risk signals.",
        formatDays(recency),
        "risk",
      ));
    } else if (recency <= 30) {
      reasons.push(reason(
        "recency-low",
        "Recent booking activity",
        "The customer booked recently, which usually lowers immediate churn concern.",
        formatDays(recency),
        "protective",
      ));
    }
  }

  if (isNumber(freq3m)) {
    if (freq3m === 0) {
      reasons.push(reason(
        "freq-3m-none",
        "No bookings in the last 3 months",
        "Recent inactivity suggests the customer may be drifting away.",
        formatNumber(freq3m),
        "risk",
      ));
    } else if (freq3m >= 2) {
      reasons.push(reason(
        "freq-3m-repeat",
        "Repeat recent bookings",
        "Multiple bookings in the last 3 months point to active engagement.",
        formatNumber(freq3m),
        "protective",
      ));
    }
  }

  if (isNumber(freq12m)) {
    if (freq12m <= 1) {
      reasons.push(reason(
        "freq-12m-low",
        "Low booking frequency",
        "Only a small amount of booking history makes the relationship easier to lose.",
        formatNumber(freq12m),
        "risk",
      ));
    } else if (freq12m >= 6) {
      reasons.push(reason(
        "freq-12m-strong",
        "Strong yearly booking frequency",
        "A consistent booking habit over the year is a positive retention signal.",
        formatNumber(freq12m),
        "protective",
      ));
    }
  }

  if (isNumber(gap)) {
    if (gap >= 90) {
      reasons.push(reason(
        "gap-long",
        "Long gaps between bookings",
        "The customer's normal booking rhythm is sparse, which increases churn uncertainty.",
        formatDays(gap),
        "risk",
      ));
    } else if (gap <= 45) {
      reasons.push(reason(
        "gap-short",
        "Frequent booking rhythm",
        "Shorter gaps between bookings indicate an established service pattern.",
        formatDays(gap),
        "protective",
      ));
    }
  }

  if (isNumber(cancellationRate)) {
    if (cancellationRate >= 0.25) {
      reasons.push(reason(
        "cancellations-high",
        "High cancellation rate",
        "Cancelled bookings can indicate weakening intent or service friction.",
        formatPercent(cancellationRate),
        "risk",
      ));
    } else if (cancellationRate === 0) {
      reasons.push(reason(
        "cancellations-none",
        "No cancellations observed",
        "Completed bookings without cancellations are a healthy engagement signal.",
        formatPercent(cancellationRate),
        "protective",
      ));
    }
  }

  if (isNumber(spendTrend)) {
    if (spendTrend < 0) {
      reasons.push(reason(
        "spend-trend-down",
        "Recent spend is trending down",
        "The value of recent bookings is declining, which can signal lower commitment.",
        formatTrend(spendTrend),
        "risk",
      ));
    } else if (spendTrend > 0) {
      reasons.push(reason(
        "spend-trend-up",
        "Recent spend is trending up",
        "The customer is spending more across recent bookings.",
        formatTrend(spendTrend),
        "protective",
      ));
    }
  }

  if (isNumber(totalSpend) && totalSpend > 0) {
    reasons.push(reason(
      "spend-total",
      "Recorded spend in the last year",
      "The model considered the customer's recent monetary value when scoring churn risk.",
      formatCurrency(totalSpend),
      totalSpend >= 500 ? "protective" : "neutral",
    ));
  }

  if (isNumber(serviceVariety)) {
    if (serviceVariety <= 1) {
      reasons.push(reason(
        "service-variety-low",
        "Limited service variety",
        "The customer has used a narrow set of services, so there are fewer engagement anchors.",
        formatNumber(serviceVariety),
        "risk",
      ));
    } else if (serviceVariety >= 3) {
      reasons.push(reason(
        "service-variety-high",
        "Uses multiple services",
        "Broader service usage can make the customer relationship stickier.",
        formatNumber(serviceVariety),
        "protective",
      ));
    }
  }

  if (reasons.length === 0 && isNumber(tenure)) {
    reasons.push(reason(
      "tenure-context",
      "Limited standout risk signals",
      "The available feature snapshot does not show a dominant risk driver, so use the score alongside the booking history.",
      formatDays(tenure),
      "neutral",
    ));
  }

  return reasons;
}

export function buildChurnReasoning(
  score: Pick<ChurnScore, "feature_snapshot" | "risk_bucket"> | undefined,
): ChurnReasoning {
  const snapshot = score?.feature_snapshot ?? {};
  const reasons = buildReasons(snapshot);
  const manualAdjustment = snapshot.manual_retention_status;
  return {
    summary:
      manualAdjustment
        ? "This score includes a manual retention adjustment from a recorded customer conversation. The raw model signal is preserved in the feature snapshot for audit."
        : "These signals expose the booking, spend, and behaviour values used by the churn model. They explain the business reasoning behind the score, but they are not causal model attribution.",
    reasons,
    featureRows: buildChurnFeatureRows(snapshot),
  };
}