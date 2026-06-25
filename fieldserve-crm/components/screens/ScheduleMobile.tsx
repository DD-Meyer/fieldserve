import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import RouteStopRow, { type RouteStop } from "../RouteStopRow";
import SegmentedToggle from "../SegmentedToggle";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useJobs, type Job } from "../../lib/hooks/useJobs";

const OPTIONS = [
  { key: "optimized", label: "Optimized" },
  { key: "manual", label: "Manual" },
];

function formatHours(min: number) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  const sign = min < 0 ? "-" : "";
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
}

function toStop(j: Job, order: number): RouteStop {
  const d = new Date(j.scheduled_at);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    order,
    time,
    customer: j.customer_name || `Customer #${j.customer}`,
    location: j.address || j.customer_address || "—",
    durationMin: j.duration_minutes ?? 30,
    distanceKm: 0, // populated by ML scheduler once wired
  };
}

export default function ScheduleMobile() {
  const [mode, setMode] = useState("optimized");
  const tabBarSpace = useTabBarSpace();

  const { data, isLoading, error } = useJobs({
    date: "today",
    ordering: "scheduled_at",
  });

  const stops: RouteStop[] = useMemo(
    () => (data?.results ?? []).map(toStop),
    [data],
  );

  const totalDurationMin = stops.reduce((s, x) => s + x.durationMin, 0);
  // Placeholder hero numbers until ML scheduler returns optimised totals.
  const savedMin = stops.length > 1 ? 45 : 0;
  const totalKm = stops.length * 4.2;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
      <Text className="text-xl font-bold text-slate-900">
        Smart Schedule Optimizer
      </Text>
      <Text className="text-xs text-slate-500 mt-1 mb-4">
        Today&apos;s route from the backend; travel-time savings via ML coming soon.
      </Text>

      <View className="bg-blue-600 rounded-2xl p-5">
        <Text className="text-blue-100 text-xs">Estimated time saved</Text>
        <Text className="text-white text-3xl font-bold mt-1">
          {formatHours(savedMin)}
        </Text>
        <View className="flex-row mt-4 pt-4 border-t border-blue-500">
          <View className="flex-1">
            <Text className="text-blue-100 text-[11px]">On-site time</Text>
            <Text className="text-white text-sm font-semibold mt-0.5">
              {formatHours(totalDurationMin)}
            </Text>
          </View>
          <View className="w-px bg-blue-500" />
          <View className="flex-1 pl-4">
            <Text className="text-blue-100 text-[11px]">Total stops</Text>
            <Text className="text-white text-sm font-semibold mt-0.5">
              {stops.length}
            </Text>
            <Text className="text-blue-200 text-[11px] mt-0.5">
              ~{totalKm.toFixed(1)} km
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-5">
        <SegmentedToggle options={OPTIONS} active={mode} onChange={setMode} />
      </View>

      <Text className="mt-5 mb-3 text-base font-semibold text-slate-900">
        Today&apos;s Route
      </Text>
      <View className="bg-white rounded-2xl border border-slate-200 p-4">
        {isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="text-xs text-red-600">Could not load route.</Text>
        ) : stops.length === 0 ? (
          <Text className="text-xs text-slate-500">
            No jobs scheduled today.
          </Text>
        ) : (
          stops.map((stop, i) => (
            <RouteStopRow
              key={stop.order}
              stop={stop}
              isLast={i === stops.length - 1}
            />
          ))
        )}
      </View>

      <View className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex-row">
        <Text className="text-amber-700 text-sm mr-2">ⓘ</Text>
        <Text className="text-amber-800 text-xs leading-4 flex-1">
          Travel distance/time savings will be computed by the ML scheduler in the
          next iteration.
        </Text>
      </View>
    </ScrollView>
  );
}
