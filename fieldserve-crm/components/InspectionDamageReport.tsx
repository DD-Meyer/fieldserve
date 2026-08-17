import { Image, Text, View } from "react-native";

import type { Damage, Inspection } from "@/lib/hooks/useInspections";

export default function InspectionDamageReport({ inspection }: { inspection: Inspection }) {
  const damages = inspection.analysis.damages ?? [];
  const size = inspection.analysis.image_size;
  const summary = inspection.analysis.summary;

  if (inspection.analysis_status !== "done") return null;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: "#e2e8f0", padding: 12, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#0f172a", fontSize: 13, fontWeight: "800" }}>Detection report</Text>
          <Text style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
            {damages.length
              ? describeCounts(summary?.counts_by_type ?? countByType(damages))
              : "No visible damage found in this view"}
          </Text>
        </View>
        {summary ? (
          <Text style={{ color: "#475569", fontSize: 11 }}>
            Peak {Math.round(summary.highest_confidence * 100)}%
          </Text>
        ) : null}
      </View>

      {inspection.photo_url && size ? (
        <View style={{ width: "100%", aspectRatio: size.width / size.height, borderRadius: 8, overflow: "hidden", backgroundColor: "#e2e8f0" }}>
          <Image source={{ uri: inspection.photo_url }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          {damages.map((damage, index) => (
            <DamageBox key={`${damage.label}-${index}`} damage={damage} width={size.width} height={size.height} index={index} />
          ))}
        </View>
      ) : null}

      {damages.map((damage, index) => (
        <View key={`${damage.label}-detail-${index}`} style={{ flexDirection: "row", gap: 10, padding: 10, borderRadius: 8, backgroundColor: "#f8fafc" }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: confidenceColour(damage.confidence_band), alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "white", fontSize: 11, fontWeight: "800" }}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ color: "#0f172a", fontSize: 13, fontWeight: "700", textTransform: "capitalize" }}>
                {damage.label.replaceAll("_", " ")}
              </Text>
              <Text style={{ color: confidenceTextColour(damage.confidence_band), fontSize: 12, fontWeight: "800" }}>
                {Math.round(damage.confidence * 100)}% {damage.confidence_band ?? confidenceBand(damage.confidence)}
              </Text>
            </View>
            <Text style={{ color: "#64748b", fontSize: 11, marginTop: 3, textTransform: "capitalize" }}>
              {damage.region ?? "Position unavailable"} · {damage.area_percent ?? calculateArea(damage, size)}% of image
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>
              Box {damage.bbox.map((value) => Math.round(value)).join(", ")}
            </Text>
          </View>
        </View>
      ))}

      <Text style={{ color: "#94a3b8", fontSize: 10 }}>
        Model {inspection.analysis.model_version ?? "unknown"} · Captured {new Date(inspection.created_at).toLocaleString()}
      </Text>
    </View>
  );
}

function DamageBox({ damage, width, height, index }: { damage: Damage; width: number; height: number; index: number }) {
  const [x1, y1, x2, y2] = damage.bbox;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: `${clamp((x1 / width) * 100)}%`,
        top: `${clamp((y1 / height) * 100)}%`,
        width: `${clamp(((x2 - x1) / width) * 100)}%`,
        height: `${clamp(((y2 - y1) / height) * 100)}%`,
        borderWidth: 2,
        borderColor: "#facc15",
        backgroundColor: "rgba(250,204,21,0.10)",
      }}
    >
      <View style={{ alignSelf: "flex-start", backgroundColor: "#facc15", paddingHorizontal: 4, paddingVertical: 1 }}>
        <Text style={{ color: "#0f172a", fontSize: 9, fontWeight: "900" }}>{index + 1}</Text>
      </View>
    </View>
  );
}

function countByType(damages: Damage[]) {
  return damages.reduce<Record<string, number>>((counts, damage) => {
    counts[damage.label] = (counts[damage.label] ?? 0) + 1;
    return counts;
  }, {});
}

function describeCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([label, count]) => `${count} ${label.replaceAll("_", " ")}`)
    .join(" · ");
}

function calculateArea(damage: Damage, size?: { width: number; height: number }) {
  if (!size) return 0;
  const [x1, y1, x2, y2] = damage.bbox;
  return Math.round((((x2 - x1) * (y2 - y1)) / (size.width * size.height)) * 1000) / 10;
}

function confidenceBand(confidence: number) {
  return confidence >= 0.75 ? "high" : confidence >= 0.5 ? "medium" : "low";
}

function confidenceColour(band?: string) {
  return band === "high" ? "#16a34a" : band === "medium" ? "#d97706" : "#dc2626";
}

function confidenceTextColour(band?: string) {
  return band === "high" ? "#15803d" : band === "medium" ? "#b45309" : "#b91c1c";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
