import { Pressable, Text, View } from "react-native";

type Props = {
  label: string;
  value?: string;
  description?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  right?: React.ReactNode;
};

export default function SettingsRow({
  label,
  value,
  description,
  onPress,
  chevron = true,
  destructive,
  right,
}: Props) {
  const Container: React.ComponentType<any> = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      className={"px-4 py-3.5 flex-row items-center " + (onPress ? "active:bg-slate-50" : "")}
    >
      <View className="flex-1 pr-3">
        <Text
          className={
            "text-[15px] " +
            (destructive ? "text-red-600 font-medium" : "text-slate-900")
          }
        >
          {label}
        </Text>
        {description ? (
          <Text className="text-xs text-slate-500 mt-0.5">{description}</Text>
        ) : null}
      </View>
      {right ??
        (value ? (
          <Text className="text-sm text-slate-500 mr-1">{value}</Text>
        ) : null)}
      {chevron && onPress ? <Text className="text-slate-400 text-lg ml-1">›</Text> : null}
    </Container>
  );
}
