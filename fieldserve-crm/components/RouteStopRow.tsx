import { Text, View } from "react-native";

export type RouteStop = {
  order: number;
  time: string;
  customer: string;
  location: string;
  durationMin: number;
  distanceKm: number;
};

type Props = {
  stop: RouteStop;
  isLast?: boolean;
};

export default function RouteStopRow({ stop, isLast }: Props) {
  return (
    <View className="flex-row">
      <View className="w-10 items-center">
        <View className="h-8 w-8 rounded-full bg-blue-600 items-center justify-center">
          <Text className="text-white text-xs font-bold">{stop.order}</Text>
        </View>
        {!isLast ? <View className="flex-1 w-px bg-slate-200 mt-1" /> : null}
      </View>

      <View className="flex-1 pb-5 pl-3">
        <View className="flex-row justify-between items-start">
          <Text className="text-sm font-semibold text-slate-900 flex-1 pr-2">
            {stop.customer}
          </Text>
          <Text className="text-xs font-semibold text-blue-600">{stop.time}</Text>
        </View>
        <Text className="text-xs text-slate-500 mt-0.5">{stop.location}</Text>
        <Text className="text-[11px] text-slate-400 mt-1">
          {stop.durationMin} min · {stop.distanceKm.toFixed(1)} km drive
        </Text>
      </View>
    </View>
  );
}
