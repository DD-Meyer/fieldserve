import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";

export type InspectionPhase = "before" | "after";

export type InspectionAngle =
  | "front"
  | "front_left"
  | "front_right"
  | "left"
  | "right"
  | "rear_left"
  | "rear_right"
  | "rear"
  | "roof"
  | "interior_front"
  | "interior_rear"
  | "wheels"
  | "other";

export const INSPECTION_ANGLES: { key: InspectionAngle; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "front_left", label: "Front left" },
  { key: "front_right", label: "Front right" },
  { key: "left", label: "Left side" },
  { key: "right", label: "Right side" },
  { key: "rear_left", label: "Rear left" },
  { key: "rear_right", label: "Rear right" },
  { key: "rear", label: "Rear" },
  { key: "roof", label: "Roof" },
  { key: "wheels", label: "Wheels" },
  { key: "interior_front", label: "Interior front" },
  { key: "interior_rear", label: "Interior rear" },
];

export const WALKAROUND_STEPS: {
  key: InspectionAngle;
  label: string;
  guidance: string;
  marker: { x: number; y: number };
}[] = [
  { key: "front", label: "Front", guidance: "Face the vehicle head-on", marker: { x: 160, y: 25 } },
  { key: "front_left", label: "Front left", guidance: "Stand at the front-left corner", marker: { x: 75, y: 45 } },
  { key: "left", label: "Left side", guidance: "Keep the full left side in frame", marker: { x: 45, y: 95 } },
  { key: "rear_left", label: "Rear left", guidance: "Stand at the rear-left corner", marker: { x: 75, y: 145 } },
  { key: "rear", label: "Rear", guidance: "Face the vehicle directly from behind", marker: { x: 160, y: 165 } },
  { key: "rear_right", label: "Rear right", guidance: "Stand at the rear-right corner", marker: { x: 245, y: 145 } },
  { key: "right", label: "Right side", guidance: "Keep the full right side in frame", marker: { x: 275, y: 95 } },
  { key: "front_right", label: "Front right", guidance: "Stand at the front-right corner", marker: { x: 245, y: 45 } },
];

export type Damage = {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  region?: string;
  area_percent?: number;
  confidence_band?: "high" | "medium" | "low";
};

export type InspectionAnalysis = {
  damages?: Damage[];
  summary?: {
    total: number;
    counts_by_type: Record<string, number>;
    highest_confidence: number;
  };
  model_version?: string;
  image_size?: { width: number; height: number };
};

export type FrameCheck = {
  ready: boolean;
  reason: string;
  guidance: string;
  vehicle?: {
    label: string;
    confidence: number;
    bbox: [number, number, number, number];
    coverage: number;
    center: [number, number];
    clipped: boolean;
  };
};

export type AnalysisStatus = "pending" | "running" | "done" | "failed";

export type Inspection = {
  id: number;
  job: number;
  phase: InspectionPhase;
  angle: InspectionAngle;
  photo_url: string | null;
  analysis: InspectionAnalysis;
  analysis_status: AnalysisStatus;
  analysis_error: string;
  damage_count: number;
  created_at: string;
  updated_at: string;
};

export type InspectionPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Inspection[];
};

export function useJobInspections(jobId: number | null) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["inspections", jobId],
    queryFn: () =>
      api.get<InspectionPage>("/api/inspections/", { job: jobId ?? undefined }),
    enabled: !!isSignedIn && jobId != null,
    staleTime: 10_000,
  });
}

export type UploadInspectionInput = {
  jobId: number;
  phase: InspectionPhase;
  angle: InspectionAngle;
  /** Local file URI (native) or blob URL (web). */
  photoUri: string;
  /** Optional filename override for the multipart part. */
  fileName?: string;
};

/** Build a FormData part compatible with both React Native and web. */
async function buildPhotoPart(
  photoUri: string,
  fileName: string,
): Promise<Blob | { uri: string; name: string; type: string }> {
  // Web: fetch the blob URL.
  if (
    typeof document !== "undefined" &&
    (photoUri.startsWith("blob:") || photoUri.startsWith("data:"))
  ) {
    const r = await fetch(photoUri);
    return await r.blob();
  }
  // React Native: FormData accepts { uri, name, type } shape.
  const type = /\.png($|\?)/i.test(photoUri) ? "image/png" : "image/jpeg";
  return { uri: photoUri, name: fileName, type };
}

export function useCreateInspection() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadInspectionInput) => {
      const fileName = input.fileName || `${input.angle}.jpg`;
      const form = new FormData();
      form.append("job", String(input.jobId));
      form.append("phase", input.phase);
      form.append("angle", input.angle);
      const part = await buildPhotoPart(input.photoUri, fileName);
      // React Native's FormData typings don't match the DOM signature.
      form.append("photo", part as any, fileName);
      return api.postFormData<Inspection>("/api/inspections/", form);
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["inspections", row.job] });
      qc.invalidateQueries({ queryKey: ["job", row.job] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useCheckVehicleFrame() {
  const api = useApi();
  return useMutation({
    mutationFn: async (photoUri: string) => {
      const form = new FormData();
      const part = await buildPhotoPart(photoUri, "frame-check.jpg");
      form.append("image", part as any, "frame-check.jpg");
      return api.postFormData<FrameCheck>("/api/inspections/check-frame/", form);
    },
  });
}

export function useReanalyseInspection() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<Inspection>(`/api/inspections/${id}/reanalyse/`),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["inspections", row.job] });
    },
  });
}
