import { useMemo } from "react";
import { Text, View } from "react-native";

import ExpandableLeafletMap from "./ExpandableLeafletMap";
import type { LeafletHeatCell } from "./leafletHtml";
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
  if (!b || typeof b !== "object") return false;
  const cast = b as Record<string, any>;

  const latMin = Number(cast.lat_min ?? cast.latMin);
  const latMax = Number(cast.lat_max ?? cast.latMax);
  const lngMin = Number(cast.lng_min ?? cast.lngMin);
  const lngMax = Number(cast.lng_max ?? cast.lngMax);

  return (
    Number.isFinite(latMin) &&
    Number.isFinite(latMax) &&
    Number.isFinite(lngMin) &&
    Number.isFinite(lngMax)
  );
}

export default function HeatmapPlaceholder({
  cells,
  bounds,
  loading,
  error,
  pointCount,
}: Props) {
  // Normalize heat cells into valid LeafletHeatCell structures
  const normalizedCells = useMemo<LeafletHeatCell[]>(() => {
    if (!cells || !Array.isArray(cells)) return [];
    return cells
      .map((c: any) => {
        const latitude = Number(c.latitude ?? c.lat);
        const longitude = Number(c.longitude ?? c.lng ?? c.lon);
        const intensity = Number(c.intensity ?? c.weight ?? c.value ?? c.count ?? 0.5);
        return { latitude, longitude, intensity };
      })
      .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }, [cells]);

  const hasRealData = normalizedCells.length > 0;

  // Calculate center from bounds OR dynamically compute average coordinates from cells
  const center = useMemo(() => {
    if (!hasRealData) return undefined;

    if (isFullBounds(bounds)) {
      const cast = bounds as Record<string, any>;
      const latMin = Number(cast.lat_min ?? cast.latMin);
      const latMax = Number(cast.lat_max ?? cast.latMax);
      const lngMin = Number(cast.lng_min ?? cast.lngMin);
      const lngMax = Number(cast.lng_max ?? cast.lngMax);

      return {
        latitude: (latMin + latMax) / 2,
        longitude: (lngMin + lngMax) / 2,
      };
    }

    // Dynamic center fallback computed from cells
    const sum = normalizedCells.reduce(
      (acc, c) => {
        acc.lat += c.latitude;
        acc.lng += c.longitude;
        return acc;
      },
      { lat: 0, lng: 0 }
    );

    return {
      latitude: sum.lat / normalizedCells.length,
      longitude: sum.lng / normalizedCells.length,
    };
  }, [hasRealData, bounds, normalizedCells]);

  return (
    <View className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
      <View className="h-56 relative bg-slate-100">
        {hasRealData ? (
          <ExpandableLeafletMap
            title="Demand heat map"
            heatCells={normalizedCells}
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
              ? `KDE · ${pointCount ?? normalizedCells.length} customers · ${normalizedCells.length} cells`
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