import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import { useApi } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type Job,
  type JobStatus,
} from "../../lib/hooks/useJobs";

const SafeAreaView = styled(RNSafeAreaView);

const STATUS_TONES: Record<JobStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-slate-100", text: "text-slate-700" },
  scheduled: { bg: "bg-blue-100", text: "text-blue-700" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700" },
  completed: { bg: "bg-green-100", text: "text-green-700" },
  cancelled: { bg: "bg-red-100", text: "text-red-700" },
};

const TRANSITIONS: Record<JobStatus, { to: JobStatus; label: string }[]> = {
  pending: [
    { to: "scheduled", label: "Accept & Schedule" },
    { to: "cancelled", label: "Decline" },
  ],
  scheduled: [
    { to: "in_progress", label: "Start Job" },
    { to: "cancelled", label: "Cancel" },
  ],
  in_progress: [
    { to: "completed", label: "Mark Completed" },
    { to: "cancelled", label: "Cancel" },
  ],
  completed: [],
  cancelled: [],
};

function useJob(id: number | null) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["job", id],
    queryFn: () => api.get<Job>(`/api/jobs/${id}/`),
    staleTime: 10_000,
    enabled: !!isSignedIn && id != null,
  });
}

function useTransition() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: JobStatus }) =>
      api.post<Job>(`/api/jobs/${id}/transition/`, { status }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["job", vars.id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

function StatusPill({ status }: { status: JobStatus }) {
  const t = STATUS_TONES[status];
  return (
    <View className={`px-2.5 py-1 rounded-full ${t.bg}`}>
      <Text className={`text-[11px] font-semibold ${t.text}`}>
        {status.replace("_", " ")}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text
        className="text-sm text-slate-900 font-medium flex-1 text-right ml-3"
        numberOfLines={2}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const jobId = id ? Number(id) : null;

  const { data: job, isLoading, error } = useJob(jobId);
  const transition = useTransition();

  const price = useMemo(() => {
    if (!job?.price) return "$0.00";
    const n = typeof job.price === "string" ? Number(job.price) : job.price;
    return `$${(n || 0).toFixed(2)}`;
  }, [job?.price]);

  const doTransition = (to: JobStatus, label: string) => {
    if (!job) return;
    const destructive = to === "cancelled";
    Alert.alert(
      label,
      `Change status from "${job.status.replace("_", " ")}" to "${to.replace("_", " ")}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: destructive ? "destructive" : "default",
          onPress: async () => {
            try {
              await transition.mutateAsync({ id: job.id, status: to });
            } catch (e: any) {
              Alert.alert("Failed", e?.message || "Could not update status.");
            }
          },
        },
      ],
    );
  };

  if (!jobId) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <AppHeader title="Booking" />
        <View className="p-6">
          <Text className="text-slate-500">Missing job id.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading || !job) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <AppHeader title="Booking" />
        <View className="p-6 items-center">
          {error ? (
            <Text className="text-xs text-red-600">Could not load booking.</Text>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const actions = TRANSITIONS[job.status];

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title={`Booking #${job.id}`} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <Pressable
          onPress={() => router.back()}
          className="self-start mb-3 px-2 py-1"
        >
          <Text className="text-xs text-blue-600">← Back</Text>
        </Pressable>

        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs text-slate-500">Status</Text>
            <StatusPill status={job.status} />
          </View>
          <Text className="text-xl font-bold text-slate-900 mt-1">
            {job.service_type}
          </Text>
          <Text className="text-xs text-slate-500 mt-1">
            Scheduled · {new Date(job.scheduled_at).toLocaleString()}
          </Text>
          {job.completed_at ? (
            <Text className="text-[11px] text-slate-400 mt-1">
              Completed {new Date(job.completed_at).toLocaleString()}
            </Text>
          ) : null}
        </View>

        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">Customer</Text>
          <InfoRow label="Name" value={job.customer_name} />
          <InfoRow label="Address" value={job.address || job.customer_address} />
          <Pressable
            onPress={() => router.push(`/customer/${job.customer}`)}
            className="mt-3 bg-blue-600 rounded-full py-2 items-center"
          >
            <Text className="text-white text-xs font-semibold">
              View customer profile
            </Text>
          </Pressable>
        </View>

        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">Details</Text>
          <InfoRow label="Price" value={price} />
          <InfoRow
            label="Duration"
            value={job.duration_minutes ? `${job.duration_minutes} min` : "—"}
          />
          <InfoRow label="Notes" value={job.notes} />
          <InfoRow
            label="Pre-service walkaround"
            value={`${job.walkaround_captured_angles.length}/8 captured`}
          />
          {job.status === "in_progress" || job.status === "completed" ? (
            <InfoRow
              label="After-service walkaround"
              value={`${job.after_walkaround_captured_angles.length}/8 captured`}
            />
          ) : null}
          <Pressable
            onPress={() => router.push(`/job/inspect/${job.id}`)}
            className={`mt-3 rounded-full py-2 items-center ${
              job.walkaround_complete ? "bg-green-700" : "bg-slate-900"
            }`}
          >
            <Text className="text-white text-xs font-semibold">
              {job.walkaround_complete
                ? "Walkaround complete · Review images"
                : "Complete guided walkaround"}
            </Text>
          </Pressable>
        </View>

        {actions.length > 0 ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4">
            <Text className="text-sm font-bold text-slate-900 mb-2">
              Actions
            </Text>
            {actions.map((a) => {
              const destructive = a.to === "cancelled";
              const needsWalkaround =
                a.to === "in_progress" && !job.walkaround_complete;
              const needsAfterWalkaround =
                a.to === "completed" && !job.after_walkaround_complete;
              return (
                <Pressable
                  key={a.to}
                  onPress={() =>
                    needsWalkaround
                      ? router.push(`/job/inspect/${job.id}`)
                      : needsAfterWalkaround
                        ? router.push(`/job/inspect/${job.id}?phase=after`)
                      : doTransition(a.to, a.label)
                  }
                  disabled={transition.isPending}
                  className={`rounded-full py-3 items-center mb-2 ${
                    destructive
                      ? "border border-red-300"
                      : a.to === "completed"
                        ? "bg-green-600"
                        : "bg-blue-600"
                  }`}
                  style={transition.isPending ? { opacity: 0.5 } : undefined}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      destructive ? "text-red-600" : "text-white"
                    }`}
                  >
                    {needsWalkaround
                      ? `Take walkaround to start (${job.walkaround_captured_angles.length}/8)`
                      : needsAfterWalkaround
                        ? `Take after images to complete (${job.after_walkaround_captured_angles.length}/8)`
                      : a.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 items-center">
            <Text className="text-xs text-slate-500">
              No further transitions from {job.status.replace("_", " ")}.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
