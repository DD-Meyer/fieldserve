import { Text, View } from "react-native";

export type Appointment = {
  id: string | number;
  time: string;
  durationMin: number;
  customer: string;
  service: string;
  resource: string;
  resourceColor: string;
  noShowRisk?: "low" | "medium" | "high";
};

const noShowTone = {
  low: { bg: "bg-green-100", text: "text-green-700", label: "Low" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "Med" },
  high: { bg: "bg-red-100", text: "text-red-700", label: "High" },
};

export default function AppointmentRow({
  appt,
  isLast,
}: {
  appt: Appointment;
  isLast?: boolean;
}) {
  return (
    <View
      className={
        "px-4 py-3 flex-row " +
        (isLast ? "" : "border-b border-slate-100")
      }
    >
      <View className="w-16 pr-2">
        <Text className="text-sm font-semibold text-slate-900">{appt.time}</Text>
        <Text className="text-[11px] text-slate-500 mt-0.5">
          {appt.durationMin}m
        </Text>
      </View>

      <View
        style={{ backgroundColor: appt.resourceColor }}
        className="w-1 rounded-full mr-3"
      />

      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-slate-900">
          {appt.customer}
        </Text>
        <Text className="text-xs text-slate-600 mt-0.5">{appt.service}</Text>
        <Text className="text-[11px] text-slate-400 mt-1">{appt.resource}</Text>
      </View>

      {appt.noShowRisk ? (
        <View className="items-end">
          <Text className="text-[10px] text-slate-500 mb-1">No-show</Text>
          <View
            className={`px-2 py-0.5 rounded-full ${noShowTone[appt.noShowRisk].bg}`}
          >
            <Text
              className={`text-[10px] font-semibold ${noShowTone[appt.noShowRisk].text}`}
            >
              {noShowTone[appt.noShowRisk].label}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
