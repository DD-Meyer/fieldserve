import { Text, View } from "react-native";

import type { Damage, Inspection } from "@/lib/hooks/useInspections";

export default function InspectionBreakdownReport({
  inspection,
}: {
  inspection?: Inspection | null;
}) {
  if (!inspection || inspection.analysis_status !== "done") return null;

  const damages = inspection.analysis?.damages ?? [];
  const summary = inspection.analysis?.summary;

  // 1. Aggregated Metrics
  const totalDamages = damages.length;
  const totalAreaPercent = Math.min(
    100,
    Math.round(
      damages.reduce((acc, d) => acc + (d.area_percent ?? 0), 0) * 10
    ) / 10
  );

  // Group by Region / Location
  const regionStats = damages.reduce<
    Record<string, { count: number; labels: Set<string> }>
  >((acc, d) => {
    const regionKey = d.region ?? "unspecified_region";
    if (!acc[regionKey]) {
      acc[regionKey] = { count: 0, labels: new Set() };
    }
    acc[regionKey].count += 1;
    acc[regionKey].labels.add(d.label.replaceAll("_", " "));
    return acc;
  }, {});

  // Group by Damage Type
  const typeStats = damages.reduce<
    Record<string, { count: number; maxConfidence: number }>
  >((acc, d) => {
    if (!acc[d.label]) {
      acc[d.label] = { count: 0, maxConfidence: d.confidence };
    }
    acc[d.label].count += 1;
    acc[d.label].maxConfidence = Math.max(
      acc[d.label].maxConfidence,
      d.confidence
    );
    return acc;
  }, {});

  // Confidence Band Breakdown
  const confidenceBands = damages.reduce(
    (acc, d) => {
      const band = d.confidence_band ?? getConfidenceBand(d.confidence);
      acc[band] = (acc[band] ?? 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 } as Record<"high" | "medium" | "low", number>
  );

  const severityLevel = getOverallSeverity(totalDamages, totalAreaPercent);

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: "#e2e8f0", padding: 12, gap: 14 }}>
      {/* HEADER & OVERALL RATING */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: "#0f172a", fontSize: 13, fontWeight: "800" }}>
            Inspection Summary Breakdown
          </Text>
          <Text style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
            Categorized damage severity & zone analysis
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: severityLevel.bgColor,
            }}
          >
            <Text style={{ color: severityLevel.textColor, fontSize: 11, fontWeight: "800" }}>
              {severityLevel.label}
            </Text>
          </View>
        </View>
        <View
          
        >
          
        </View>
      </View>

      {/* QUICK METRICS GRID */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <MetricTile
          label="Total Issues"
          value={String(totalDamages)}
          subtext={totalDamages === 0 ? "Clean view" : "Detections"}
        />
        <MetricTile
          label="Affected Area"
          value={`${totalAreaPercent}%`}
          subtext="Surface coverage"
        />
        <MetricTile
          label="Peak Confidence"
          value={`${Math.round((summary?.highest_confidence ?? 0) * 100)}%`}
          subtext="Model accuracy"
        />
      </View>

      {/* TYPE BREAKDOWN */}
      <View style={{ backgroundColor: "#f8fafc", borderRadius: 8, padding: 10, gap: 8 }}>
        <Text style={{ color: "#0f172a", fontSize: 12, fontWeight: "700" }}>
          Damage Type Distribution
        </Text>
        {Object.keys(typeStats).length === 0 ? (
          <Text style={{ color: "#94a3b8", fontSize: 11 }}>No defects recorded.</Text>
        ) : (
          Object.entries(typeStats).map(([type, stat]) => (
            <View key={type} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#0284c7" }} />
                <Text style={{ color: "#334155", fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
                  {type.replaceAll("_", " ")}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#64748b", fontSize: 11 }}>
                  Peak {Math.round(stat.maxConfidence * 100)}%
                </Text>
                <View style={{ backgroundColor: "#e2e8f0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: "#0f172a", fontSize: 11, fontWeight: "800" }}>
                    ×{stat.count}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ZONE / REGION BREAKDOWN */}
      <View style={{ backgroundColor: "#f8fafc", borderRadius: 8, padding: 10, gap: 8 }}>
        <Text style={{ color: "#0f172a", fontSize: 12, fontWeight: "700" }}>
          Affected Zones & Regions
        </Text>
        {Object.keys(regionStats).length === 0 ? (
          <Text style={{ color: "#94a3b8", fontSize: 11 }}>No specific zones impacted.</Text>
        ) : (
          Object.entries(regionStats).map(([region, stat]) => (
            <View key={region} style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#0f172a", fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>
                  {region.replaceAll("_", " ")}
                </Text>
                <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "700" }}>
                  {stat.count} {stat.count === 1 ? "defect" : "defects"}
                </Text>
              </View>
              <Text style={{ color: "#94a3b8", fontSize: 10, textTransform: "capitalize" }}>
                Includes: {Array.from(stat.labels).join(", ")}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* AI CONFIDENCE SCORE BAR */}
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "600" }}>
            Detection Band Breakdown
          </Text>
          <Text style={{ color: "#64748b", fontSize: 11 }}>
            High ({confidenceBands.high}) · Med ({confidenceBands.medium}) · Low ({confidenceBands.low})
          </Text>
        </View>
        <View style={{ height: 6, width: "100%", backgroundColor: "#e2e8f0", borderRadius: 3, flexDirection: "row", overflow: "hidden" }}>
          {totalDamages > 0 ? (
            <>
              <View style={{ flex: confidenceBands.high, backgroundColor: "#16a34a" }} />
              <View style={{ flex: confidenceBands.medium, backgroundColor: "#d97706" }} />
              <View style={{ flex: confidenceBands.low, backgroundColor: "#dc2626" }} />
            </>
          ) : (
            <View style={{ flex: 1, backgroundColor: "#16a34a" }} />
          )}
        </View>
      </View>
    </View>
  );
}

function MetricTile({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#f1f5f9" }}>
      <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: "#0f172a", fontSize: 16, fontWeight: "800", marginTop: 2 }}>{value}</Text>
      <Text style={{ color: "#94a3b8", fontSize: 9, marginTop: 1 }}>{subtext}</Text>
    </View>
  );
}

function getConfidenceBand(confidence: number): "high" | "medium" | "low" {
  return confidence >= 0.75 ? "high" : confidence >= 0.5 ? "medium" : "low";
}

function getOverallSeverity(count: number, areaPercent: number) {
  if (count === 0) {
    return { label: "Pass / Clean", bgColor: "#dcfce7", textColor: "#15803d" };
  }
  if (count <= 2 && areaPercent < 5) {
    return { label: "Minor Issues", bgColor: "#fef9c3", textColor: "#a16207" };
  }
  if (count <= 5 && areaPercent < 15) {
    return { label: "Moderate Damage", bgColor: "#ffedd5", textColor: "#c2410c" };
  }
  return { label: "Action Needed", bgColor: "#fee2e2", textColor: "#b91c1c" };
}