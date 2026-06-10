import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import CatchmentZoneRow, { type CatchmentZone } from "../CatchmentZoneRow";
import FilterPills from "../FilterPills";
import HeatmapPlaceholder from "../HeatmapPlaceholder";

const RANGES = [
  { key: "all", label: "All Time" },
  { key: "90d", label: "Last 90 Days" },
  { key: "new", label: "New Customers" },
];

const ZONES: CatchmentZone[] = [
  { id: 1, name: "EC1 · City Centre", customers: 84, sharePct: 28, tag: "stable" },
  { id: 2, name: "N1 · Islington", customers: 61, sharePct: 20, tag: "growing" },
  { id: 3, name: "E2 · Hackney", customers: 47, sharePct: 16, tag: "growing" },
  { id: 4, name: "SE1 · Southwark", customers: 34, sharePct: 11, tag: "stable" },
  { id: 5, name: "NW1 · Camden", customers: 22, sharePct: 7, tag: "declining" },
  { id: 6, name: "E14 · Canary Wharf", customers: 12, sharePct: 4, tag: "opportunity" },
];

export default function MapFixed() {
  const [range, setRange] = useState("90d");

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text className="text-xl font-bold text-slate-900">Customer Catchment</Text>
      <Text className="text-xs text-slate-500 mt-1 mb-4">
        Where your customers come from — KDE on home postcodes
      </Text>

      <View className="mb-4">
        <FilterPills pills={RANGES} active={range} onChange={setRange} />
      </View>

      <HeatmapPlaceholder />

      <View className="mt-6 mb-2 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-slate-900">
          Top Customer Areas
        </Text>
        <Text className="text-xs text-slate-500">
          {RANGES.find((r) => r.key === range)?.label}
        </Text>
      </View>
      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {ZONES.map((z) => (
          <CatchmentZoneRow key={z.id} zone={z} />
        ))}
      </View>

      <View className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex-row">
        <View className="h-9 w-9 rounded-full bg-blue-100 items-center justify-center mr-3">
          <Text className="text-blue-700">★</Text>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-blue-900">
            Marketing Opportunity
          </Text>
          <Text className="text-xs text-blue-800 mt-1 leading-4">
            E14 has only 4% of your bookings but a high concentration of your
            target demographic. A localised promotion could grow this catchment
            without diluting your existing core.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
