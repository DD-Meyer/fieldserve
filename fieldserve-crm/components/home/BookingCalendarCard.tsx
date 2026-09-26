import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { colors, typography } from "@/constants/theme";
import type { Job, JobStatus } from "@/lib/hooks/useJobs";
import { addDays, dateKey, jobsByDay } from "./dashboardData";

type Props = {
  month: Date;
  jobs: Job[];
  selectedDate: Date;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: Date) => void;
};

const JOB_LABEL_COLOURS: Record<JobStatus, string> = {
  scheduled: "#3B82F6",
  completed: "#10B981",
  cancelled: "#EF4444",
  pending: "#64748b",
  in_progress: "#d97706",
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function agendaTime(job: Job) {
  return new Date(job.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function BookingCalendarCard({ month, jobs, selectedDate, onMonthChange, onSelectDate }: Props) {
  const router = useRouter();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(firstDay, -firstDay.getDay());
  const groupedJobs = jobsByDay(jobs);
  const selectedJobs = groupedJobs.get(dateKey(selectedDate)) ?? [];
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const monthLabel = month.toLocaleDateString(undefined, { month: "short", year: "numeric" });

  return (
    <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="border rounded-2xl px-3 pt-3 pb-4 shadow-sm">
      <View className="flex-row items-center justify-between px-1 mb-3">
        <Text style={typography.styles.caption}>{monthLabel}</Text>
        <View className="flex-row gap-1">
          <Pressable onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityLabel="Previous month" className="p-1">
            <Ionicons name="chevron-back" size={18} color="#94A3B8" />
          </Pressable>
          <Pressable onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityLabel="Next month" className="p-1">
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>
        </View>
      </View>
      <View className="flex-row mb-1">
        {WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={[typography.styles.calendarWeekday, { flex: 1, textAlign: "center" }]}>{day}</Text>)}
      </View>
      <View className="flex-row flex-wrap">
        {days.map((day) => {
          const key = dateKey(day);
          const selected = key === dateKey(selectedDate);
          const inMonth = day.getMonth() === month.getMonth();
          const count = groupedJobs.get(key)?.length ?? 0;
          return (
            <Pressable key={key} onPress={() => onSelectDate(day)} accessibilityLabel={`Show bookings for ${day.toDateString()}`} style={{ width: "14.2857%", height: 38, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.accent : "transparent" }}>
                <Text style={[typography.styles.calendarDay, { color: selected ? "#FFFFFF" : inMonth ? colors.foreground : "#CBD5E1" }]}>{day.getDate()}</Text>
              </View>
              {count > 0 ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: selected ? "#FFFFFF" : colors.accent, marginTop: 1 }} /> : <View style={{ height: 5 }} />}
            </Pressable>
          );
        })}
      </View>
      <Text style={[typography.styles.eyebrow, { marginTop: 12 }]}>{selectedDate.toDateString() === new Date().toDateString() ? "TODAY" : selectedDate.toDateString()} ({selectedJobs.length} bookings)</Text>
      {selectedJobs.length ? selectedJobs.map((job) => (
        <View key={job.id} className="flex-row items-center mt-2">
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginRight: 8 }} />
          <Text style={[typography.styles.caption, { width: 50, color: JOB_LABEL_COLOURS[job.status] }]}>{agendaTime(job)}</Text>
          <Pressable
            key={job.id}
            onPress={() => router.push(`/job/${job.id}` as any)}
          >
            <Text style={[typography.styles.body, { flex: 1 }]} numberOfLines={1}>{job.customer_name || `Customer #${job.customer}`}</Text>
          </Pressable>
        </View>
      )) : <Text style={[typography.styles.caption, { marginTop: 6 }]}>No bookings scheduled.</Text>}
    </View>
  );
}