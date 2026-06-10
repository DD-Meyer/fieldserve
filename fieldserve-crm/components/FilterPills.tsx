import { Pressable, ScrollView, Text, View } from "react-native";

type Pill = { key: string; label: string };

type Props = {
  pills: Pill[];
  active: string;
  onChange: (key: string) => void;
};

export default function FilterPills({ pills, active, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 4, paddingRight: 8 }}
    >
      <View className="flex-row gap-2">
        {pills.map((p) => {
          const isActive = p.key === active;
          return (
            <Pressable
              key={p.key}
              onPress={() => onChange(p.key)}
              className={
                "px-4 py-2 rounded-full border " +
                (isActive
                  ? "bg-slate-900 border-slate-900"
                  : "bg-white border-slate-200")
              }
            >
              <Text
                className={
                  "text-xs font-semibold " +
                  (isActive ? "text-white" : "text-slate-700")
                }
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
