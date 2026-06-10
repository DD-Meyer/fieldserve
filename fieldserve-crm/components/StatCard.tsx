import { Text, View } from "react-native";

type Props = {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
};

export default function StatCard({ label, value, delta, positive = true }: Props) {
  return (
    <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-200">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="mt-1 text-2xl font-bold text-slate-900">{value}</Text>
      {delta ? (
        <Text
          className={`mt-1 text-xs font-medium ${
            positive ? "text-green-600" : "text-red-600"
          }`}
        >
          {delta}
        </Text>
      ) : null}
    </View>
  );
}
