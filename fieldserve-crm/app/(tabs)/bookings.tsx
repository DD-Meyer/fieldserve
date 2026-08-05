import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import "react-native-url-polyfill/auto";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import CreateBookingModal from "../../components/CreateBookingModal";
import FilterPills from "../../components/FilterPills";
import { useJobs, type Job, type JobStatus } from "../../lib/hooks/useJobs";
import { useShareBooking } from "../../lib/hooks/useShareBooking";

const SafeAreaView = styled(RNSafeAreaView);

type StatusFilter = "all" | JobStatus;

const PILLS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "scheduled", label: "Scheduled" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const SORTS: { key: string; label: string }[] = [
  { key: "-scheduled_at", label: "Newest first" },
  { key: "scheduled_at", label: "Oldest first" },
  { key: "-created_at", label: "Recently added" },
  { key: "-price", label: "Highest price" },
];

const STATUS_TONES: Record<JobStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-slate-100", text: "text-slate-700" },
  scheduled: { bg: "bg-blue-100", text: "text-blue-700" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700" },
  completed: { bg: "bg-green-100", text: "text-green-700" },
  cancelled: { bg: "bg-red-100", text: "text-red-700" },
};

function StatusPill({ status }: { status: JobStatus }) {
  const t = STATUS_TONES[status];
  return (
    <View className={`px-2 py-0.5 rounded-full ${t.bg}`}>
      <Text className={`text-[10px] font-semibold ${t.text}`}>
        {status.replace("_", " ")}
      </Text>
    </View>
  );
}

function money(price: Job["price"]): string {
  const n = typeof price === "string" ? Number(price) : price ?? 0;
  return `$${(n || 0).toFixed(2)}`;
}


export default function BookingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [ordering, setOrdering] = useState<string>("-scheduled_at");
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useJobs({
    status: status === "all" ? undefined : status,
    ordering,
  });

  const jobs = data?.results ?? [];

  const counts = useMemo(() => {
    const base: Record<JobStatus, number> = {
      pending: 0,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    jobs.forEach((j) => {
      base[j.status] = (base[j.status] ?? 0) + 1;
    });
    return base;
  }, [jobs]);

  // Handle sharing the booking form link
  const { handleShare } = useShareBooking();

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="Bookings" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xl font-bold text-slate-900">All Bookings</Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setShowCreate(true)}
              className="px-3 py-1.5 rounded-full bg-blue-600"
            >
              <Text className="text-xs font-semibold text-white">+ New</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              className="px-3 py-1.5 rounded-full bg-slate-900"
            >
              <Text className="text-xs font-semibold text-white">Share</Text>
            </Pressable>
            <Pressable
              onPress={() => refetch()}
              className="px-3 py-1.5 rounded-full bg-slate-100"
            >
              <Text className="text-xs font-semibold text-slate-700">
                {isFetching ? "…" : "Refresh"}
              </Text>
            </Pressable>
          </View>
        </View>
        <Text className="text-xs text-slate-500 mb-4">
          {data?.count ?? 0} total in this view
        </Text>

        <View className="flex-row flex-wrap gap-2 mb-4">
          {(["pending", "scheduled", "in_progress", "completed", "cancelled"] as JobStatus[]).map(
            (s) => (
              <View
                key={s}
                className="flex-1 bg-white rounded-xl border border-slate-200 p-2 items-center"
              >
                <Text className="text-base font-bold text-slate-900">
                  {counts[s]}
                </Text>
                <Text className="text-[10px] text-slate-500 capitalize">
                  {s.replace("_", " ")}
                </Text>
              </View>
            ),
          )}
        </View>

        <View className="mb-3">
          <FilterPills
            pills={PILLS}
            active={status}
            onChange={(k) => setStatus(k as StatusFilter)}
          />
        </View>

        <View className="mb-4">
          <Text className="text-[11px] font-semibold text-slate-500 mb-1">
            Sort
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {SORTS.map((s) => {
              const active = ordering === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setOrdering(s.key)}
                  className={`px-3 py-1.5 rounded-full border ${
                    active
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-slate-700"
                    }`}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {isLoading ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center">
            <Text className="text-xs text-red-600">Could not load bookings.</Text>
          </View>
        ) : jobs.length === 0 ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center">
            <Text className="text-slate-500 text-sm">No bookings here.</Text>
          </View>
        ) : (
          jobs.map((j) => (
            <Pressable
              key={j.id}
              onPress={() => router.push(`/job/${j.id}` as any)}
              className="bg-white rounded-2xl border border-slate-200 p-4 mb-3"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-semibold text-slate-900">
                    {j.service_type}
                  </Text>
                  <Text className="text-xs text-slate-500 mt-0.5">
                    {j.customer_name}
                  </Text>
                  <Text className="text-[11px] text-slate-400 mt-1">
                    {new Date(j.scheduled_at).toLocaleString()}
                  </Text>
                </View>
                <View className="items-end">
                  <StatusPill status={j.status} />
                  <Text className="text-sm font-bold text-slate-900 mt-2">
                    {money(j.price)}
                  </Text>
                </View>
              </View>
              {j.address ? (
                <Text className="text-[11px] text-slate-500 mt-2" numberOfLines={1}>
                  {j.address}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>

      <CreateBookingModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => refetch()}
      />
    </SafeAreaView>
  );
}
