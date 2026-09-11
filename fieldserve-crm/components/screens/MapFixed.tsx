import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import DemandZoneRow from "../DemandZoneRow";
import DemandZoneModal from "../DemandZoneModal";
import FilterPills from "../FilterPills";
import HeatmapPlaceholder from "../HeatmapPlaceholder";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useHeatmap, type DemandZone } from "../../lib/hooks/usePredictions";
import { useServices } from "../../lib/hooks/useServices";

const RANGES = [
  { key: "all", label: "All Time" },
  { key: "90d", label: "Last 90 Days" },
  { key: "new", label: "New Customers" },
];

export default function MapFixed() {
  const [range, setRange] = useState("90d");
  const [selectedZone, setSelectedZone] = useState<DemandZone | null>(null);
  const tabBarSpace = useTabBarSpace();
  const heatmap = useHeatmap({ weight_by: "count", range: range as "all" | "90d" | "new" });
  const services = useServices();
  const zones = heatmap.data?.zones ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
      <Text className="text-xl font-bold text-slate-900">Customer Catchment</Text>
      <Text className="text-xs text-slate-500 mt-1 mb-4">
        Where your customers come from — KDE on home postcodes
      </Text>

      <View className="mb-4">
        <FilterPills pills={RANGES} active={range} onChange={setRange} />
      </View>

      <HeatmapPlaceholder
        cells={heatmap.data?.cells}
        bounds={heatmap.data?.bounds}
        pointCount={heatmap.data?.point_count}
        loading={heatmap.isLoading}
        error={heatmap.error}
      />

      <View className="mt-6 mb-2 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-slate-900">
          Top Customer Areas
        </Text>
        <Text className="text-xs text-slate-500">
          {RANGES.find((r) => r.key === range)?.label}
        </Text>
      </View>
      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {zones.length ? zones.map((zone) => (
          <DemandZoneRow key={zone.id} zone={zone} onPress={() => setSelectedZone(zone)} />
        )) : (
          <Text className="px-4 py-4 text-xs text-slate-500">
            {heatmap.isLoading ? "Calculating customer areas…" : "Not enough recorded locations to rank customer areas."}
          </Text>
        )}
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
            {zones[0]
              ? `${zones[0].name} contains the strongest recorded customer concentration. Compare its service mix with your catalogue before targeting the area.`
              : "Record more customer locations to identify the strongest customer catchment."}
          </Text>
        </View>
      </View>
      <DemandZoneModal
        zone={selectedZone}
        services={services.data?.results ?? []}
        onClose={() => setSelectedZone(null)}
      />
    </ScrollView>
  );
}
