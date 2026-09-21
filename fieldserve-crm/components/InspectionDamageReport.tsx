import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, Text, TextInput, View } from "react-native";

import type { Damage, Inspection } from "@/lib/hooks/useInspections";
import { useReviewDamage } from "@/lib/hooks/useInspections";

const DAMAGE_LABELS = [
  "dent",
  "scratch",
  "crack",
  "glass_shatter",
  "lamp_broken",
  "tire_flat",
] as const;

type ReviewState = {
  index: number;
  label: string;
  note: string;
} | null;

export default function InspectionDamageReport({ inspection }: { inspection: Inspection }) {
  const damages = inspection.analysis.damages ?? [];
  const size = inspection.analysis.image_size;
  const summary = inspection.analysis.summary;
  const reviewDamage = useReviewDamage();
  const [review, setReview] = useState<ReviewState>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (inspection.analysis_status !== "done") return null;

  const annotation = inspection.damage_annotation;

  async function saveReview(remove = false) {
    if (!review) return;
    if (!review.note.trim()) {
      setReviewError("Add a short review note before saving.");
      return;
    }
    const corrected = damages
      .map((damage, index) => (
        index === review.index ? { ...damage, label: review.label } : damage
      ))
      .filter((_damage, index) => !(remove && index === review.index));
    try {
      await reviewDamage.mutateAsync({
        inspectionId: inspection.id,
        boxes: corrected,
        note: review.note.trim(),
      });
      setReview(null);
      setReviewError(null);
    } catch (error: any) {
      setReviewError(error?.message || "Could not save damage review.");
    }
  }

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
            <Pressable
              onPress={() => {
                setReview({ index, label: damage.label, note: annotation?.note ?? "" });
                setReviewError(null);
              }}
              style={{ alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#e2e8f0" }}
            >
              <Text style={{ color: "#334155", fontSize: 11, fontWeight: "700" }}>
                Review detection
              </Text>
            </Pressable>
          </View>
        </View>
      ))}

      {annotation?.note ? (
        <View style={{ borderRadius: 8, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#bbf7d0", padding: 10 }}>
          <Text style={{ color: "#166534", fontSize: 11, fontWeight: "800" }}>Reviewer note</Text>
          <Text style={{ color: "#166534", fontSize: 11, marginTop: 3, lineHeight: 16 }}>{annotation.note}</Text>
        </View>
      ) : null}

      <Text style={{ color: "#94a3b8", fontSize: 10 }}>
        Model {inspection.analysis.model_version ?? "unknown"} · Captured {new Date(inspection.created_at).toLocaleString()}
      </Text>

      <Modal
        visible={review != null}
        transparent
        animationType="slide"
        onRequestClose={() => setReview(null)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: "#0f172a", fontSize: 18, fontWeight: "800" }}>Review detection</Text>
              <Pressable onPress={() => setReview(null)}>
                <Text style={{ color: "#64748b" }}>Close</Text>
              </Pressable>
            </View>

            {review ? (
              <>
                <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 6 }}>
                  Confidence {Math.round((damages[review.index]?.confidence ?? 0) * 100)}% · Box {damages[review.index]?.bbox.map((value) => Math.round(value)).join(", ")}
                </Text>
                <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700", marginBottom: 8 }}>Correct label</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {DAMAGE_LABELS.map((label) => {
                    const active = review.label === label;
                    return (
                      <Pressable
                        key={label}
                        onPress={() => setReview({ ...review, label })}
                        style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? "#2563eb" : "#e2e8f0", backgroundColor: active ? "#eff6ff" : "white" }}
                      >
                        <Text style={{ color: active ? "#1d4ed8" : "#475569", fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>
                          {label.replaceAll("_", " ")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>Review note</Text>
                <TextInput
                  value={review.note}
                  onChangeText={(note) => setReview({ ...review, note })}
                  placeholder="e.g. Box is correct, but damage is a scratch rather than a dent."
                  multiline
                  style={{ minHeight: 92, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: "#0f172a", textAlignVertical: "top" }}
                />
                {reviewError ? <Text style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{reviewError}</Text> : null}
                <Pressable
                  onPress={() => saveReview(false)}
                  disabled={reviewDamage.isPending}
                  style={{ marginTop: 14, paddingVertical: 12, borderRadius: 999, alignItems: "center", backgroundColor: "#2563eb", opacity: reviewDamage.isPending ? 0.6 : 1 }}
                >
                  {reviewDamage.isPending ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "800" }}>Save review</Text>}
                </Pressable>
                <Pressable
                  onPress={() => saveReview(true)}
                  disabled={reviewDamage.isPending}
                  style={{ marginTop: 10, paddingVertical: 12, borderRadius: 999, alignItems: "center", backgroundColor: "#fee2e2", opacity: reviewDamage.isPending ? 0.6 : 1 }}
                >
                  <Text style={{ color: "#b91c1c", fontWeight: "800" }}>Remove this box from review set</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
