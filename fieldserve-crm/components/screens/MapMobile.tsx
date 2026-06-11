import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import DemandZoneRow, { type DemandZone } from "../DemandZoneRow";
import FilterPills from "../FilterPills";
import HeatmapPlaceholder from "../HeatmapPlaceholder";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";

const RANGES = [
  { key: "all", label: "All Time" },
  { key: "30d", label: "Last 30 Days" },
  { key: "weekends", label: "Weekends" },
];

const ZONES: DemandZone[] = [
  { id: 1, name: "Riverside / Downtown", bookings: 42, density: "high", deltaPct: 18 },
  { id: 2, name: "Pine St Corridor", bookings: 28, density: "high", deltaPct: 9 },
  { id: 3, name: "Oak Lane", bookings: 19, density: "medium", deltaPct: -4 },
  { id: 4, name: "Market Square", bookings: 14, density: "medium", deltaPct: 6 },
  { id: 5, name: "Lakeside North", bookings: 7, density: "low", deltaPct: 22 },
];

export default function MapMobile() {
  const [range, setRange] = useState("30d");
  const tabBarSpace = useTabBarSpace();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
      <Text className="text-xl font-bold text-slate-900">Demand Heat Map</Text>
      <Text className="text-xs text-slate-500 mt-1 mb-4">
        Geographic demand analysis using KDE
      </Text>

      <View className="mb-4">
        <FilterPills pills={RANGES} active={range} onChange={setRange} />
      </View>

      <HeatmapPlaceholder />

      <View className="mt-6 mb-2 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-slate-900">
          Top Demand Zones
        </Text>
        <Text className="text-xs text-slate-500">
          {RANGES.find((r) => r.key === range)?.label}
        </Text>
      </View>
      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {ZONES.map((z) => (
          <DemandZoneRow key={z.id} zone={z} />
        ))}
      </View>

      <View className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex-row">
        <View className="h-9 w-9 rounded-full bg-blue-100 items-center justify-center mr-3">
          <Text className="text-blue-700">★</Text>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-blue-900">
            Opportunity Detected
          </Text>
          <Text className="text-xs text-blue-800 mt-1 leading-4">
            Lakeside North shows a +22% demand spike with low active coverage.
            Consider scheduling a promotional run or assigning a worker to that
            area this weekend.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
