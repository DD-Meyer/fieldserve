import { Pressable, Text, View } from "react-native";

type Option = { key: string; label: string };

type Props = {
  options: Option[];
  active: string;
  onChange: (key: string) => void;
};

export default function SegmentedToggle({ options, active, onChange }: Props) {
  return (
    <View className="flex-row bg-slate-100 rounded-xl p-1">
      {options.map((o) => {
        const isActive = o.key === active;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className={
              "flex-1 py-2 rounded-lg items-center " +
              (isActive ? "bg-white shadow-sm" : "")
            }
          >
            <Text
              className={
                "text-xs font-semibold " +
                (isActive ? "text-slate-900" : "text-slate-500")
              }
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
