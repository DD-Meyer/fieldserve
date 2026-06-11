import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import RouteStopRow, { type RouteStop } from "../RouteStopRow";
import SegmentedToggle from "../SegmentedToggle";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";

const OPTIMIZED: RouteStop[] = [
  { order: 1, time: "09:00", customer: "Sarah Johnson", location: "12 Riverside Ave", durationMin: 60, distanceKm: 3.2 },
  { order: 2, time: "10:30", customer: "Marcus Lee", location: "Apt 4B, 88 Pine St", durationMin: 45, distanceKm: 2.1 },
  { order: 3, time: "12:15", customer: "Priya Patel", location: "31 Oak Lane", durationMin: 75, distanceKm: 4.4 },
  { order: 4, time: "14:30", customer: "Tom Becker", location: "204 Market Sq", durationMin: 50, distanceKm: 5.0 },
];

const MANUAL: RouteStop[] = [
  { order: 1, time: "09:00", customer: "Tom Becker", location: "204 Market Sq", durationMin: 50, distanceKm: 8.6 },
  { order: 2, time: "10:45", customer: "Sarah Johnson", location: "12 Riverside Ave", durationMin: 60, distanceKm: 6.8 },
  { order: 3, time: "13:00", customer: "Priya Patel", location: "31 Oak Lane", durationMin: 75, distanceKm: 5.4 },
  { order: 4, time: "15:30", customer: "Marcus Lee", location: "Apt 4B, 88 Pine St", durationMin: 45, distanceKm: 4.9 },
];

const OPTIONS = [
  { key: "optimized", label: "Optimized" },
  { key: "manual", label: "Manual" },
];

function totals(stops: RouteStop[]) {
  const km = stops.reduce((s, x) => s + x.distanceKm, 0);
  const travelMin = Math.round((km / 40) * 60);
  return { km, travelMin };
}

function formatHours(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ScheduleMobile() {
  const [mode, setMode] = useState("optimized");
  const tabBarSpace = useTabBarSpace();

  const stops = mode === "optimized" ? OPTIMIZED : MANUAL;

  const { saved, optTotals } = useMemo(() => {
    const o = totals(OPTIMIZED);
    const m = totals(MANUAL);
    return {
      saved: { min: m.travelMin - o.travelMin, km: m.km - o.km },
      optTotals: o,
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
      <Text className="text-xl font-bold text-slate-900">
        Smart Schedule Optimizer
      </Text>
      <Text className="text-xs text-slate-500 mt-1 mb-4">
        AI-reordered route based on travel time and job duration
      </Text>

      <View className="bg-blue-600 rounded-2xl p-5">
        <Text className="text-blue-100 text-xs">Estimated time saved</Text>
        <Text className="text-white text-3xl font-bold mt-1">
          {formatHours(saved.min)}
        </Text>
        <View className="flex-row mt-4 pt-4 border-t border-blue-500">
          <View className="flex-1">
            <Text className="text-blue-100 text-[11px]">Travel Time</Text>
            <Text className="text-white text-sm font-semibold mt-0.5">
              {formatHours(optTotals.travelMin)}
            </Text>
            <Text className="text-blue-200 text-[11px] mt-0.5">
              −{saved.min} min
            </Text>
          </View>
          <View className="w-px bg-blue-500" />
          <View className="flex-1 pl-4">
            <Text className="text-blue-100 text-[11px]">Total Distance</Text>
            <Text className="text-white text-sm font-semibold mt-0.5">
              {optTotals.km.toFixed(1)} km
            </Text>
            <Text className="text-blue-200 text-[11px] mt-0.5">
              −{saved.km.toFixed(1)} km
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-5">
        <SegmentedToggle options={OPTIONS} active={mode} onChange={setMode} />
      </View>

      <Text className="mt-5 mb-3 text-base font-semibold text-slate-900">
        Today's Route
      </Text>
      <View className="bg-white rounded-2xl border border-slate-200 p-4">
        {stops.map((stop, i) => (
          <RouteStopRow
            key={stop.order}
            stop={stop}
            isLast={i === stops.length - 1}
          />
        ))}
      </View>

      <View className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex-row">
        <Text className="text-amber-700 text-sm mr-2">ⓘ</Text>
        <Text className="text-amber-800 text-xs leading-4 flex-1">
          Optimized routes are model suggestions. Confirm before sharing with
          your team — traffic and customer preferences may change.
        </Text>
      </View>
    </ScrollView>
  );
}
