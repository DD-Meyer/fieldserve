import { Text, View } from "react-native";

import type { RiskLevel } from "../lib/churnRisk";

export { levelFromProb, type RiskLevel } from "../lib/churnRisk";

const tones: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-red-100", text: "text-red-700", label: "High Risk" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "Medium Risk" },
  low: { bg: "bg-green-100", text: "text-green-700", label: "Low Risk" },
};

type Props = {
  level: RiskLevel;
  probability: number;
};

export default function RiskBadge({ level, probability }: Props) {
  const t = tones[level];
  return (
    <View className={`px-3 py-1 rounded-full items-center ${t.bg}`}>
      <Text className={`text-[8px] font-medium ${t.text}`}>{Math.round(probability * 100)}% {t.label}</Text>
    </View>
  );
}
