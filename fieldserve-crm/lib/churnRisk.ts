export type RiskLevel = "high" | "medium" | "low";

export const HIGH_RISK_THRESHOLD = 0.65;
export const MEDIUM_RISK_THRESHOLD = 0.35;

export function levelFromProb(probability: number): RiskLevel {
  if (probability >= HIGH_RISK_THRESHOLD) return "high";
  if (probability >= MEDIUM_RISK_THRESHOLD) return "medium";
  return "low";
}