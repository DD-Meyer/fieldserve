import { Text, View } from "react-native";

export type DemandZone = {
  id: string | number;
  name: string;
  bookings: number;
  density: "high" | "medium" | "low";
  deltaPct: number;
};

const densityTone: Record<DemandZone["density"], { bg: string; text: string; label: string }> = {
  high: { bg: "bg-red-100", text: "text-red-700", label: "High density" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "Medium" },
  low: { bg: "bg-green-100", text: "text-green-700", label: "Low density" },
};

export default function DemandZoneRow({ zone }: { zone: DemandZone }) {
  const t = densityTone[zone.density];
  const positive = zone.deltaPct >= 0;
  return (
    <View className="px-4 py-3 border-b border-slate-100 flex-row items-center">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{zone.name}</Text>
        <View className="flex-row items-center mt-1">
          <Text className="text-xs text-slate-500 mr-2">
            {zone.bookings} bookings
          </Text>
          <View className={`px-2 py-0.5 rounded-full ${t.bg}`}>
            <Text className={`text-[10px] font-semibold ${t.text}`}>{t.label}</Text>
          </View>
        </View>
      </View>
      <Text
        className={
          "text-sm font-semibold " + (positive ? "text-green-600" : "text-red-600")
        }
      >
        {positive ? "+" : ""}
        {zone.deltaPct}%
      </Text>
    </View>
  );
}
