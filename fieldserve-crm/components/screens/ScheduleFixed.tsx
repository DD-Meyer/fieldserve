import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import AppointmentRow, { type Appointment } from "../AppointmentRow";
import SegmentedToggle from "../SegmentedToggle";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";

const STAFF_COLORS = {
  Mia: "#2563eb",
  Daniel: "#16a34a",
  Jordan: "#7c3aed",
} as const;

const APPOINTMENTS_BY_STAFF: Appointment[] = [
  { id: 1, time: "09:00", durationMin: 60, customer: "Olivia Hart", service: "Cut & Blow-dry", resource: "Mia", resourceColor: STAFF_COLORS.Mia, noShowRisk: "low" },
  { id: 2, time: "10:15", durationMin: 90, customer: "Liam Park", service: "Full Colour", resource: "Daniel", resourceColor: STAFF_COLORS.Daniel, noShowRisk: "medium" },
  { id: 3, time: "11:00", durationMin: 30, customer: "Ana Silva", service: "Beard Trim", resource: "Jordan", resourceColor: STAFF_COLORS.Jordan, noShowRisk: "low" },
  { id: 4, time: "12:00", durationMin: 60, customer: "Noah Walsh", service: "Highlights touch-up", resource: "Mia", resourceColor: STAFF_COLORS.Mia, noShowRisk: "high" },
  { id: 5, time: "13:30", durationMin: 45, customer: "Sophia Reyes", service: "Cut", resource: "Daniel", resourceColor: STAFF_COLORS.Daniel, noShowRisk: "low" },
  { id: 6, time: "14:30", durationMin: 75, customer: "Ethan Vega", service: "Balayage", resource: "Mia", resourceColor: STAFF_COLORS.Mia, noShowRisk: "medium" },
  { id: 7, time: "16:00", durationMin: 30, customer: "Maya Cole", service: "Fringe trim", resource: "Jordan", resourceColor: STAFF_COLORS.Jordan, noShowRisk: "low" },
];

const APPOINTMENTS_BY_CHAIR: Appointment[] = [
  { id: 11, time: "09:00", durationMin: 60, customer: "Olivia Hart", service: "Cut & Blow-dry", resource: "Chair 1", resourceColor: "#2563eb", noShowRisk: "low" },
  { id: 12, time: "10:15", durationMin: 90, customer: "Liam Park", service: "Full Colour", resource: "Chair 2", resourceColor: "#16a34a", noShowRisk: "medium" },
  { id: 13, time: "11:00", durationMin: 30, customer: "Ana Silva", service: "Beard Trim", resource: "Chair 3", resourceColor: "#7c3aed", noShowRisk: "low" },
  { id: 14, time: "12:00", durationMin: 60, customer: "Noah Walsh", service: "Highlights touch-up", resource: "Chair 1", resourceColor: "#2563eb", noShowRisk: "high" },
  { id: 15, time: "13:30", durationMin: 45, customer: "Sophia Reyes", service: "Cut", resource: "Chair 2", resourceColor: "#16a34a", noShowRisk: "low" },
  { id: 16, time: "14:30", durationMin: 75, customer: "Ethan Vega", service: "Balayage", resource: "Chair 1", resourceColor: "#2563eb", noShowRisk: "medium" },
  { id: 17, time: "16:00", durationMin: 30, customer: "Maya Cole", service: "Fringe trim", resource: "Chair 3", resourceColor: "#7c3aed", noShowRisk: "low" },
];

const VIEW_OPTIONS = [
  { key: "staff", label: "By Staff" },
  { key: "chair", label: "By Chair" },
];

export default function ScheduleFixed() {
  const [view, setView] = useState("staff");
  const tabBarSpace = useTabBarSpace();
  const appointments =
    view === "staff" ? APPOINTMENTS_BY_STAFF : APPOINTMENTS_BY_CHAIR;

  const highRiskCount = appointments.filter((a) => a.noShowRisk === "high").length;
  const utilisationPct = 78;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
      <Text className="text-xl font-bold text-slate-900">Today's Schedule</Text>
      <Text className="text-xs text-slate-500 mt-1 mb-4">
        Appointment slots, staff allocation, and no-show risk
      </Text>

      <View className="bg-blue-600 rounded-2xl p-5">
        <Text className="text-blue-100 text-xs">Chair utilisation</Text>
        <Text className="text-white text-3xl font-bold mt-1">{utilisationPct}%</Text>
        <View className="flex-row mt-4 pt-4 border-t border-blue-500">
          <View className="flex-1">
            <Text className="text-blue-100 text-[11px]">Bookings</Text>
            <Text className="text-white text-sm font-semibold mt-0.5">
              {appointments.length}
            </Text>
          </View>
          <View className="w-px bg-blue-500" />
          <View className="flex-1 pl-4">
            <Text className="text-blue-100 text-[11px]">High no-show risk</Text>
            <Text className="text-white text-sm font-semibold mt-0.5">
              {highRiskCount}
            </Text>
            <Text className="text-blue-200 text-[11px] mt-0.5">
              Send reminders
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-5">
        <SegmentedToggle options={VIEW_OPTIONS} active={view} onChange={setView} />
      </View>

      <View className="mt-4 flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-slate-900">
          Monday, 8 Jun
        </Text>
        <Text className="text-xs text-blue-600 font-semibold">+ Add booking</Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {appointments.map((appt, i) => (
          <AppointmentRow
            key={appt.id}
            appt={appt}
            isLast={i === appointments.length - 1}
          />
        ))}
      </View>

      <View className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex-row">
        <Text className="text-amber-700 text-sm mr-2">ⓘ</Text>
        <Text className="text-amber-800 text-xs leading-4 flex-1">
          No-show risk is a model estimate based on RFM and prior cancellations.
          High-risk customers benefit from a same-day confirmation reminder.
        </Text>
      </View>
    </ScrollView>
  );
}
