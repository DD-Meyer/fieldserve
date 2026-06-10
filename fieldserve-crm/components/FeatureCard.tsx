import { Pressable, Text, View, type ViewStyle } from "react-native";

type Tone = "red" | "blue" | "green";

const toneClasses: Record<
  Tone,
  { card: string; iconBg: string; title: string; cta: string }
> = {
  red: {
    card: "bg-red-50 border-red-100",
    iconBg: "bg-red-100",
    title: "text-red-900",
    cta: "text-red-700",
  },
  blue: {
    card: "bg-blue-50 border-blue-100",
    iconBg: "bg-blue-100",
    title: "text-blue-900",
    cta: "text-blue-700",
  },
  green: {
    card: "bg-green-50 border-green-100",
    iconBg: "bg-green-100",
    title: "text-green-900",
    cta: "text-green-700",
  },
};

type Props = {
  tone: Tone;
  glyph: string;
  title: string;
  description: string;
  cta: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export default function FeatureCard({
  tone,
  glyph,
  title,
  description,
  cta,
  onPress,
  style,
}: Props) {
  const t = toneClasses[tone];
  return (
    <Pressable
      onPress={onPress}
      style={style}
      className={`rounded-2xl border p-4 active:opacity-80 ${t.card}`}
    >
      <View className={`h-10 w-10 rounded-xl items-center justify-center ${t.iconBg}`}>
        <Text className="text-lg">{glyph}</Text>
      </View>
      <Text className={`mt-3 text-base font-semibold ${t.title}`}>{title}</Text>
      <Text className="mt-1 text-xs text-slate-600 leading-4">{description}</Text>
      <Text className={`mt-3 text-xs font-semibold ${t.cta}`}>{cta} ›</Text>
    </Pressable>
  );
}
