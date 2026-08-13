import { Text, View } from "react-native";

import LeafletMap from "./LeafletMap";
import type { HeatmapBounds, HeatmapCell } from "../lib/hooks/usePredictions";

const STOPS = [
  { color: "#dcfce7", label: "Low" },
  { color: "#fde68a", label: "" },
  { color: "#fb923c", label: "" },
  { color: "#dc2626", label: "High" },
];

type Props = {
  cells?: HeatmapCell[];
  bounds?: HeatmapBounds | Record<string, never>;
  loading?: boolean;
  error?: unknown;
  pointCount?: number;
};

function isFullBounds(b: unknown): b is HeatmapBounds {
  return (
    !!b &&
    typeof (b as HeatmapBounds).lat_min === "number" &&
    typeof (b as HeatmapBounds).lat_max === "number" &&
    typeof (b as HeatmapBounds).lng_min === "number" &&
    typeof (b as HeatmapBounds).lng_max === "number"
  );
}

export default function HeatmapPlaceholder({
  cells,
  bounds,
  loading,
  error,
  pointCount,
}: Props) {
  const hasRealData = (cells?.length ?? 0) > 0 && isFullBounds(bounds);

  const center = hasRealData && isFullBounds(bounds)
    ? {
        latitude: (bounds.lat_min + bounds.lat_max) / 2,
        longitude: (bounds.lng_min + bounds.lng_max) / 2,
      }
    : undefined;

  return (
    <View className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
      <View className="h-56 relative bg-slate-100">
        {hasRealData ? (
          <LeafletMap
            heatCells={cells}
            center={center}
            zoom={11}
            height={224}
          />
        ) : (
          <FauxBlobs />
        )}
        <View className="absolute bottom-2 left-3 bg-white/80 rounded px-2 py-1 z-10">
          <Text className="text-[10px] text-slate-600">
            {loading
              ? "Loading KDE…"
              : error
                ? "KDE preview"
                : hasRealData
                  ? `KDE • ${pointCount ?? cells?.length ?? 0} pts`
                  : "KDE preview"}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center px-4 py-3 border-t border-slate-100">
        <Text className="text-[11px] text-slate-500 mr-2">Density</Text>
        <View className="flex-1 flex-row h-2 rounded-full overflow-hidden">
          {STOPS.map((s) => (
            <View key={s.color} style={{ flex: 1, backgroundColor: s.color }} />
          ))}
        </View>
        <View className="flex-row ml-3">
          <Text className="text-[10px] text-slate-500 mr-3">Low</Text>
          <Text className="text-[10px] text-slate-500">High</Text>
        </View>
      </View>
    </View>
  );
}

// Fallback rendered when no KDE data is available yet.
function FauxBlobs() {
  return (
    <>
      <View
        style={{
          position: "absolute",
          top: 30,
          left: 50,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(220,38,38,0.55)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 80,
          left: 110,
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: "rgba(251,146,60,0.6)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 20,
          right: 30,
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "rgba(253,230,138,0.7)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 20,
          right: 60,
          width: 70,
          height: 70,
          borderRadius: 35,
          backgroundColor: "rgba(220,252,231,0.85)",
        }}
      />
    </>
  );
}
