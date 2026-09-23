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
  { key: "front", label: "Front", guidance: "Move back, centre the vehicle, and keep the whole front inside the outline", marker: { x: 160, y: 25 } },
  { key: "front_left", label: "Front left", guidance: "Stand at the front-left corner; turn slightly until the whole vehicle fits", marker: { x: 75, y: 45 } },
  { key: "left", label: "Left side", guidance: "Move back and keep the complete left side inside the outline", marker: { x: 45, y: 95 } },
  { key: "rear_left", label: "Rear left", guidance: "Stand at the rear-left corner; keep all vehicle edges visible", marker: { x: 75, y: 145 } },
  { key: "rear", label: "Rear", guidance: "Move back, centre the vehicle, and keep the whole rear inside the outline", marker: { x: 160, y: 165 } },
  { key: "rear_right", label: "Rear right", guidance: "Stand at the rear-right corner; turn slightly until the whole vehicle fits", marker: { x: 245, y: 145 } },
  { key: "right", label: "Right side", guidance: "Move back and keep the complete right side inside the outline", marker: { x: 275, y: 95 } },
  { key: "front_right", label: "Front right", guidance: "Stand at the front-right corner; keep all vehicle edges visible", marker: { x: 245, y: 45 } },
];

export type Damage = {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  region?: string;
  area_percent?: number;
  confidence_band?: "high" | "medium" | "low";
};

export type DamageAnnotation = {
  id: number;
  inspection: number;
  boxes: Damage[];
  note: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  split: "train" | "val" | "test";
  approved: boolean;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
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
  damage_annotation?: DamageAnnotation | null;
  created_at: string;
  updated_at: string;
};

export type InspectionPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Inspection[];
};

export type InspectionQuery = {
  job?: number | null;
  phase?: InspectionPhase;
  angle?: InspectionAngle;
  analysis_status?: AnalysisStatus;
};

export function useInspections(query: InspectionQuery = {}) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["inspections", query],
    queryFn: () =>
      api.get<InspectionPage>("/api/inspections/", {
        job: query.job ?? undefined,
        phase: query.phase,
        angle: query.angle,
        analysis_status: query.analysis_status,
      }),
    enabled: !!isSignedIn,
    staleTime: 30_000,
  });
}

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
      if (typeof Blob !== "undefined" && part instanceof Blob) {
        form.append("photo", part, fileName);
      } else {
        form.append("photo", part as any);
      }
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
      if (typeof Blob !== "undefined" && part instanceof Blob) {
        form.append("image", part, "frame-check.jpg");
      } else {
        form.append("image", part as any);
      }
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

export function useReviewDamage() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      inspectionId,
      boxes,
      note,
      split = "train",
    }: {
      inspectionId: number;
      boxes: Damage[];
      note: string;
      split?: DamageAnnotation["split"];
    }) =>
      api.post<DamageAnnotation>(`/api/inspections/${inspectionId}/approve-damage/`, {
        boxes,
        note,
        split,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspections"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useDeleteInspection() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/inspections/${id}/`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["inspections"] });
      qc.invalidateQueries({ queryKey: ["job"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
