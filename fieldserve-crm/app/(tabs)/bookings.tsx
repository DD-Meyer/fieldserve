import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
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
import SlideToConfirmButton from "../../components/SlideToConfirmButton";
import ShareBookingModal from "../../components/ShareBookingModal";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useRefresh } from "@/hooks/useRefresh";
import { useCurrentBusiness } from "../../lib/hooks/useBusiness";
import { useJobs, type Job, type JobStatus } from "../../lib/hooks/useJobs";

const SafeAreaView = styled(RNSafeAreaView);

type StatusFilter = "all" | JobStatus;
type BookingScope = "company" | "mine";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [ordering, setOrdering] = useState<string>("-scheduled_at");
  const [showCreate, setShowCreate] = useState(false);
  const [scope, setScope] = useState<BookingScope>("company");
  const tabBarSpace = useTabBarSpace();
  const { data: business } = useCurrentBusiness();
  const isAdmin = business?.role === "admin";
  const effectiveScope = isAdmin ? scope : "mine";

  const { data, isLoading, error, refetch } = useJobs({
    status: status === "all" ? undefined : status,
    ordering,
    assigned_to: effectiveScope === "mine" ? "me" : undefined,
  });

  const { refreshing, onRefresh } = useRefresh([refetch]);

  const jobs = useMemo(() => {
    const list = data?.results ?? [];
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter(
      (j) =>
        j.customer_name.toLowerCase().includes(q) ||
        j.service_type.toLowerCase().includes(q) ||
        (j.address ?? "").toLowerCase().includes(q) ||
        j.status.toLowerCase().includes(q),
    );
  }, [data?.results, searchQuery]);

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
  const [showShare, setShowShare] = useState(false);

  // Maintain a persistent reference to the master counts
  const masterCountsRef = useRef(counts);

  // Update master counts whenever full counts are available (e.g. on mount or when 'all' is selected)
  useEffect(() => {
    if (counts && (status === "all" || !masterCountsRef.current)) {
      masterCountsRef.current = counts;
    }
  }, [counts, status]);

  // Use persistent counts if available, otherwise fall back to current counts
  const persistentCounts = masterCountsRef.current || counts;
  const activeStatusLabel = PILLS.find((pill) => pill.key === status)?.label ?? "All";
  const activeSortLabel = SORTS.find((sort) => sort.key === ordering)?.label ?? "Newest first";
  const scopeLabel = effectiveScope === "mine" ? "Assigned to me" : "Company-wide";
  const filterSummary = isAdmin
    ? `${scopeLabel} · ${activeStatusLabel} · ${activeSortLabel}`
    : `${activeStatusLabel} · ${activeSortLabel}`;

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader
        title={effectiveScope === "mine" ? "My Bookings" : "All Bookings"}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search bookings...",
        }}
        onShare={() => setShowShare(true)}
        filter={{
          summary: filterSummary,
          children: (
            <>
            {isAdmin ? (
              <View className="flex-row rounded-lg border border-slate-200 bg-slate-100 p-1 mb-4">
                {([
                  ["company", "Company-wide"],
                  ["mine", "Assigned to me"],
                ] as const).map(([key, label]) => {
                  const selected = scope === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setScope(key)}
                      className={`flex-1 items-center rounded-md py-2 ${
                        selected ? "bg-white" : ""
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${selected ? "text-slate-900" : "text-slate-500"}`}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Horizontal Scrollable Filter Cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
              contentContainerStyle={{
                flexDirection: "row",
                alignItems: "stretch",
                gap: 8,
                paddingRight: 4,
              }}
            >
              {PILLS.map((pill) => {
                const isActive = status === pill.key;

                let numColor = "text-slate-700";
                let rippleColor = "rgba(51, 65, 85, 0.1)";

                if (pill.key === "scheduled") {
                  numColor = "text-blue-700";
                  rippleColor = "rgba(29, 78, 216, 0.1)";
                } else if (pill.key === "in_progress") {
                  numColor = "text-amber-700";
                  rippleColor = "rgba(180, 83, 9, 0.1)";
                } else if (pill.key === "completed") {
                  numColor = "text-green-700";
                  rippleColor = "rgba(21, 128, 61, 0.1)";
                } else if (pill.key === "cancelled") {
                  numColor = "text-red-700";
                  rippleColor = "rgba(185, 28, 28, 0.1)";
                }

                // Read from persistentCounts so counts stay constant during filtering
                const displayCount =
                  pill.key === "all"
                    ? (persistentCounts.pending || 0) +
                        (persistentCounts.scheduled || 0) +
                        (persistentCounts.in_progress || 0) +
                        (persistentCounts.completed || 0) +
                        (persistentCounts.cancelled || 0)
                    : persistentCounts[pill.key] || 0;

                return (
                  <Pressable
                    key={pill.key}
                    style={{ width: 104 }}
                    className={`px-3 py-2.5 rounded-xl border items-center justify-center ${
                      isActive
                        ? "border-slate-900 bg-slate-900"
                        : "border-slate-200 bg-white"
                    }`}
                    android_ripple={{ color: rippleColor }}
                    onPress={() => setStatus(pill.key as StatusFilter)}
                  >
                    <Text
                      className={`text-lg font-bold ${
                        isActive ? "text-white" : numColor
                      }`}
                    >
                      {displayCount}
                    </Text>
                    <Text
                      className={`text-[10px] font-semibold text-center uppercase tracking-wider mt-0.5 ${
                        isActive ? "text-slate-200" : "text-slate-500"
                      }`}
                      numberOfLines={1}
                    >
                      {pill.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View>
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
            </>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: tabBarSpace,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-xs text-slate-500 mb-3">
          {data?.count ?? 0} total in this view
        </Text>

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

      <SlideToConfirmButton
        label="Slide to add booking"
        onComplete={() => setShowCreate(true)}
        bottomOffset={tabBarSpace}
      />

      <CreateBookingModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => refetch()}
      />
      {showShare ? (
        <ShareBookingModal visible onClose={() => setShowShare(false)} />
      ) : null}
    </SafeAreaView>
  );
}
