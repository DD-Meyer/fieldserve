import { describe, expect, it } from "vitest";

import {
  HIGH_RISK_THRESHOLD,
  MEDIUM_RISK_THRESHOLD,
  levelFromProb,
} from "./churnRisk";

describe("levelFromProb", () => {
  it("uses the deployed high-risk boundary", () => {
    expect(levelFromProb(HIGH_RISK_THRESHOLD)).toBe("high");
    expect(levelFromProb(HIGH_RISK_THRESHOLD - 0.001)).toBe("medium");
  });

  it("uses the deployed medium-risk boundary", () => {
    expect(levelFromProb(MEDIUM_RISK_THRESHOLD)).toBe("medium");
    expect(levelFromProb(MEDIUM_RISK_THRESHOLD - 0.001)).toBe("low");
  });

  it("classifies representative probabilities", () => {
    expect(levelFromProb(0.9)).toBe("high");
    expect(levelFromProb(0.5)).toBe("medium");
    expect(levelFromProb(0.1)).toBe("low");
  });
});