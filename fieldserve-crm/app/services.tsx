import { Text, View } from "react-native";
import ScreenScaffold from "../components/ScreenScaffold";

type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
  active: boolean;
};

const SERVICES: Service[] = [
  { id: "1", name: "Full Exterior Detail", duration: 90, price: 80, active: true },
  { id: "2", name: "Interior Deep Clean", duration: 75, price: 65, active: true },
  { id: "3", name: "Ceramic Coating", duration: 240, price: 320, active: true },
  { id: "4", name: "Express Wash", duration: 25, price: 25, active: true },
  { id: "5", name: "Headlight Restoration", duration: 45, price: 55, active: false },
];

export default function ServicesScreen() {
  return (
    <ScreenScaffold
      title="Services"
      subtitle="Service catalogue and pricing"
      rightAction={{ label: "+ Add", onPress: () => {} }}
    >
      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {SERVICES.map((s, i) => (
          <View
            key={s.id}
            className={
              "px-4 py-3.5 flex-row items-center " +
              (i < SERVICES.length - 1 ? "border-b border-slate-100" : "")
            }
          >
            <View className="flex-1 pr-3">
              <View className="flex-row items-center">
                <Text className="text-[15px] font-semibold text-slate-900">
                  {s.name}
                </Text>
                {!s.active ? (
                  <View className="ml-2 px-2 py-0.5 rounded-full bg-slate-100">
                    <Text className="text-[10px] text-slate-500">Disabled</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-xs text-slate-500 mt-0.5">
                {s.duration} min
              </Text>
            </View>
            <Text className="text-sm font-semibold text-slate-900">
              ${s.price}
            </Text>
            <Text className="text-slate-400 text-lg ml-2">›</Text>
          </View>
        ))}
      </View>
    </ScreenScaffold>
  );
}
