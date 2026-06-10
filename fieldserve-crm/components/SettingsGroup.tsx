import { Text, View } from "react-native";

type Props = {
  title?: string;
  children: React.ReactNode;
  footer?: string;
};

export default function SettingsGroup({ title, children, footer }: Props) {
  return (
    <View className="mb-5">
      {title ? (
        <Text className="text-[11px] uppercase tracking-wider text-slate-500 px-1 mb-2">
          {title}
        </Text>
      ) : null}
      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {childWithDividers(children)}
      </View>
      {footer ? (
        <Text className="text-[11px] text-slate-500 px-1 mt-2 leading-4">{footer}</Text>
      ) : null}
    </View>
  );
}

function childWithDividers(children: React.ReactNode) {
  const arr = Array.isArray(children) ? children : [children];
  return arr.map((child, i) => (
    <View key={i}>
      {child}
      {i < arr.length - 1 ? <View className="h-px bg-slate-100 ml-4" /> : null}
    </View>
  ));
}
