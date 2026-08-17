/** Guided before/after vehicle walkaround and damage evidence report. */

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";

import GuidedWalkaroundCamera from "@/components/GuidedWalkaroundCamera";
import InspectionDamageReport from "@/components/InspectionDamageReport";
import ScreenScaffold from "@/components/ScreenScaffold";
import SegmentedToggle from "@/components/SegmentedToggle";
import InspectionReport from "@/components/InspectionBreakdownReport";
import {
  WALKAROUND_STEPS,
  Inspection,
  InspectionAngle,
  InspectionPhase,
  useCheckVehicleFrame,
  useCreateInspection,
  useJobInspections,
  useReanalyseInspection,
} from "@/lib/hooks/useInspections";
import { Button } from "@react-navigation/elements";
import InspectionBreakdownReport from "@/components/InspectionBreakdownReport";

export default function InspectScreen() {
  const { id, phase: requestedPhase } = useLocalSearchParams<{
    id: string;
    phase?: string;
  }>();
  const jobId = Number(id);

  const [phase, setPhase] = useState<InspectionPhase>(
    requestedPhase === "after" ? "after" : "before",
  );
  const [busyAngle, setBusyAngle] = useState<InspectionAngle | null>(null);
  const [cameraAngle, setCameraAngle] = useState<InspectionAngle | null>(null);

  const { data, isLoading } = useJobInspections(
    Number.isFinite(jobId) ? jobId : null,
  );
  const create = useCreateInspection();
  const frameCheck = useCheckVehicleFrame();
  const reanalyse = useReanalyseInspection();

  const byAngle = useMemo(() => {
    const m = new Map<InspectionAngle, Inspection>();
    for (const row of data?.results ?? []) {
      if (row.phase !== phase) continue;
      if (!WALKAROUND_STEPS.some((step) => step.key === row.angle)) continue;
      const existing = m.get(row.angle);
      if (!existing || row.created_at > existing.created_at) m.set(row.angle, row);
    }
    return m;
  }, [data, phase]);

  const captured = byAngle.size;
  const total = WALKAROUND_STEPS.length;
  const cameraStep = WALKAROUND_STEPS.findIndex((step) => step.key === cameraAngle);

  function openNextRequiredAngle() {
    const next = WALKAROUND_STEPS.find((step) => !byAngle.has(step.key));
    setCameraAngle(next?.key ?? WALKAROUND_STEPS[0].key);
  }

  async function handleGuidedCapture(photoUri: string) {
    const angle = cameraAngle;
    if (!angle || busyAngle) return;
    setBusyAngle(angle);
    try {
      await create.mutateAsync({
        jobId,
        phase,
        angle,
        photoUri,
        fileName: `${phase}-${angle}.jpg`,
      });
      const next = WALKAROUND_STEPS.find(
        (step) => step.key !== angle && !byAngle.has(step.key),
      );
      setCameraAngle(next?.key ?? null);
      if (!next) Alert.alert("Walkaround complete", "All required vehicle views are captured.");
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message ?? String(err));
    } finally {
      setBusyAngle(null);
    }
  }

  async function handleReanalyse(row: Inspection) {
    try {
      await reanalyse.mutateAsync(row.id);
    } catch (err: any) {
      Alert.alert("Retry failed", err?.message ?? String(err));
    }
  }

  const phaseInspection = useMemo(() => {
    const rows = data?.results.filter((row) => row.phase === phase) ?? [];
    if (rows.length === 0) return null;
    const latest = rows.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    return latest;
  }, [data, phase]);

  return (
    <ScreenScaffold
      title="Vehicle inspection"
      subtitle={`Job #${jobId} · ${captured}/${total} captured`}
    >
      <InspectionBreakdownReport inspection={phaseInspection} />
      <View style={{ padding: 16, gap: 16 }}>
        <SegmentedToggle
          options={[
            { key: "before", label: "Before service" },
            { key: "after", label: "After service" },
          ]}
          active={phase}
          onChange={(v) => setPhase(v as InspectionPhase)}
        />

        <View style={{ padding: 16, borderRadius: 8, backgroundColor: captured === total ? "#dcfce7" : "#eff6ff" }}>
          <Text style={{ color: "#0f172a", fontSize: 16, fontWeight: "700" }}>
            {captured === total ? "Walkaround complete" : `${total - captured} required views remaining`}
          </Text>
          <Text style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
            {phase === "before" ? "The booking can start after all exterior views are captured." : "Capture the same views after service for comparison."}
          </Text>
          <Pressable
            onPress={openNextRequiredAngle}
            style={{ marginTop: 12, paddingVertical: 11, borderRadius: 8, alignItems: "center", backgroundColor: captured === total ? "#166534" : "#2563eb" }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              {captured === total ? "Review or retake" : captured ? "Continue guided walkaround" : "Start guided walkaround"}
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {WALKAROUND_STEPS.map(({ key, label }) => {
              const row = byAngle.get(key);
              const busy = busyAngle === key || create.isPending;
              return (
                <AngleCard
                  key={key}
                  label={label}
                  row={row}
                  busy={busy}
                  onCapture={() => setCameraAngle(key)}
                  onReanalyse={row ? () => handleReanalyse(row) : undefined}
                />
              );
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </View>
      <GuidedWalkaroundCamera
        angle={cameraAngle}
        stepNumber={cameraStep + 1}
        totalSteps={total}
        uploading={create.isPending}
        onCaptured={handleGuidedCapture}
        onCheckFrame={frameCheck.mutateAsync}
        onClose={() => setCameraAngle(null)}
      />
    </ScreenScaffold>
  );
}

function AngleCard({
  label,
  row,
  busy,
  onCapture,
  onReanalyse,
}: {
  label: string;
  row?: Inspection;
  busy: boolean;
  onCapture: () => void;
  onReanalyse?: () => void;
}) {
  const status = row?.analysis_status;
  const damages = row?.damage_count ?? 0;

  return (
    <View
      style={{
        borderRadius: 12,
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: row ? "#e2e8f0" : "#cbd5e1",
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 8,
            backgroundColor: "#f1f5f9",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {row?.photo_url ? (
            <Image
              source={{ uri: row.photo_url }}
              style={{ width: 56, height: 56 }}
            />
          ) : (
            <Ionicons name="camera-outline" size={22} color="#94a3b8" />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: "#0f172a", fontWeight: "600" }}>{label}</Text>
          <StatusLine
            status={status}
            damages={damages}
            error={row?.analysis_error}
          />
        </View>

        {busy ? (
          <ActivityIndicator />
        ) : row && onReanalyse ? (
          <Pressable
            onPress={onReanalyse}
            hitSlop={8}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: "#f1f5f9",
            }}
          >
            <Text style={{ color: "#334155", fontSize: 12 }}>Retry</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onCapture}
          disabled={busy}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: row ? "#334155" : "#2563eb",
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>
            {row ? "Retake" : "Capture"}
          </Text>
        </Pressable>
      </View>
      {row ? <InspectionDamageReport inspection={row} /> : null}
    </View>
  );
}

function StatusLine({
  status,
  damages,
  error,
}: {
  status?: string;
  damages: number;
  error?: string;
}) {
  if (!status) {
    return (
      <Text style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
        Not captured
      </Text>
    );
  }
  if (status === "running" || status === "pending") {
    return (
      <Text style={{ color: "#2563eb", fontSize: 12, marginTop: 2 }}>
        Analysing…
      </Text>
    );
  }
  if (status === "failed") {
    return (
      <Text
        style={{ color: "#dc2626", fontSize: 12, marginTop: 2 }}
        numberOfLines={1}
      >
        Analysis failed{error ? ` · ${error}` : ""}
      </Text>
    );
  }
  return (
    <Text
      style={{
        color: damages > 0 ? "#b45309" : "#16a34a",
        fontSize: 12,
        marginTop: 2,
      }}
    >
      {damages > 0
        ? `${damages} damage${damages === 1 ? "" : "s"} detected`
        : "No damage detected"}
    </Text>
  );
}
