import { Text, View } from "react-native";

export type RiskLevel = "high" | "medium" | "low";

const tones: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-red-100", text: "text-red-700", label: "High Risk" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "Medium Risk" },
  low: { bg: "bg-green-100", text: "text-green-700", label: "Low Risk" },
};

export function levelFromProb(p: number): RiskLevel {
  if (p >= 0.7) return "high";
  if (p >= 0.4) return "medium";
  return "low";
}

type Props = {
  level: RiskLevel;
  probability: number;
};

export default function RiskBadge({ level, probability }: Props) {
  const t = tones[level];
  return (
    <View className={`px-2.5 py-1 rounded-full items-center ${t.bg}`}>
      <Text className={`text-[11px] font-bold ${t.text}`}>
        {Math.round(probability * 100)}%
      </Text>
      <Text className={`text-[10px] font-medium ${t.text}`}>{t.label}</Text>
    </View>
  );
}
