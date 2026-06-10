import { Text, View } from "react-native";

export type CatchmentZone = {
  id: string | number;
  name: string;
  customers: number;
  sharePct: number;
  tag?: "growing" | "stable" | "declining" | "opportunity";
};

const tagTone = {
  growing: { bg: "bg-green-100", text: "text-green-700", label: "Growing" },
  stable: { bg: "bg-slate-100", text: "text-slate-600", label: "Stable" },
  declining: { bg: "bg-red-100", text: "text-red-700", label: "Declining" },
  opportunity: { bg: "bg-blue-100", text: "text-blue-700", label: "Opportunity" },
};

export default function CatchmentZoneRow({ zone }: { zone: CatchmentZone }) {
  const tone = zone.tag ? tagTone[zone.tag] : null;
  return (
    <View className="px-4 py-3 border-b border-slate-100 flex-row items-center">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{zone.name}</Text>
        <View className="flex-row items-center mt-1">
          <Text className="text-xs text-slate-500 mr-2">
            {zone.customers} customers
          </Text>
          {tone ? (
            <View className={`px-2 py-0.5 rounded-full ${tone.bg}`}>
              <Text className={`text-[10px] font-semibold ${tone.text}`}>
                {tone.label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text className="text-sm font-semibold text-slate-900">
        {zone.sharePct}%
      </Text>
    </View>
  );
}
