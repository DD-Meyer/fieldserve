import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import AppointmentRow, { type Appointment } from "../AppointmentRow";
import BookingCalendarCard from "../home/BookingCalendarCard";
import { addDays, dateKey, monthBounds } from "../home/dashboardData";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useRefresh } from "@/hooks/useRefresh";
import { useJobs } from "../../lib/hooks/useJobs";
import { useCurrentBusiness } from "../../lib/hooks/useBusiness";

type BookingScope = "company" | "mine";

export default function ScheduleFixed() {
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [scope, setScope] = useState<BookingScope>("company");
  const business = useCurrentBusiness();
  const isAdmin = business.data?.role === "admin";
  const effectiveScope = isAdmin ? scope : "mine";
  const { from, to } = monthBounds(calendarMonth);
  const monthQuery = useJobs({
    date_from: dateKey(from),
    date_to: dateKey(to),
    ordering: "scheduled_at",
    assigned_to: effectiveScope === "mine" ? "me" : undefined,
  });
  const selectedDayQuery = useJobs({
    date: dateKey(selectedDate),
    ordering: "scheduled_at",
    assigned_to: effectiveScope === "mine" ? "me" : undefined,
  });
  const selectedJobs = (selectedDayQuery.data?.results ?? []).filter(
    (job) => job.status !== "cancelled",
  );
  const appointments: Appointment[] = selectedJobs.map((job) => ({
    id: job.id,
    time: new Date(job.scheduled_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    durationMin: job.duration_minutes ?? 30,
    customer: job.customer_name || `Customer #${job.customer}`,
    service: job.service_type || "Service",
    resource: [job.assigned_to_first_name, job.assigned_to_last_name]
      .filter(Boolean)
      .join(" ") || "Unassigned",
    resourceColor: "#2563eb",
  }));
  const { refreshing, onRefresh } = useRefresh([
    monthQuery.refetch,
    selectedDayQuery.refetch,
  ]);

  function selectDate(date: Date) {
    setSelectedDate(date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function shiftSelectedDate(days: number) {
    selectDate(addDays(selectedDate, days));
  }

  const today = dateKey(new Date());
  const selectedDateLabel = dateKey(selectedDate) === today
    ? "Today"
    : selectedDate.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text className="text-xs text-slate-500 mb-4">
        Bookings ordered by scheduled time.
      </Text>

      {isAdmin ? (
        <View className="flex-row rounded-lg border border-slate-200 bg-slate-100 p-1 mb-4">
          {([
            ["company", "Company-wide"],
            ["mine", "Assigned to me"],
          ] as const).map(([key, label]) => {
            const selected = scope === key;
            return (
              <Pressable
                key={key}
                onPress={() => setScope(key)}
                className={`flex-1 items-center rounded-md py-2 ${selected ? "bg-white" : ""}`}
              >
                <Text className={`text-xs font-semibold ${selected ? "text-slate-900" : "text-slate-500"}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View className="flex-row items-center justify-between bg-white border border-slate-200 rounded-2xl px-3 py-2 mb-4">
        <Pressable
          onPress={() => shiftSelectedDate(-1)}
          className="px-3 py-1"
          accessibilityLabel="Previous day"
        >
          <Text className="text-slate-600 text-lg">‹</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-sm font-semibold text-slate-900">{selectedDateLabel}</Text>
          {dateKey(selectedDate) !== today ? (
            <Pressable onPress={() => selectDate(new Date())}>
              <Text className="text-[11px] text-blue-600 mt-0.5">Jump to today</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => shiftSelectedDate(1)}
          className="px-3 py-1"
          accessibilityLabel="Next day"
        >
          <Text className="text-slate-600 text-lg">›</Text>
        </Pressable>
      </View>

      <BookingCalendarCard
        month={calendarMonth}
        jobs={monthQuery.data?.results ?? []}
        selectedDate={selectedDate}
        onMonthChange={setCalendarMonth}
        onSelectDate={selectDate}
        showAgenda={false}
      />

      <View className="mt-4 flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-slate-900">
          {selectedDate.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "short",
          })}
        </Text>
        <Text className="text-xs text-slate-500">{appointments.length} bookings</Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {selectedDayQuery.isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator />
          </View>
        ) : selectedDayQuery.error ? (
          <Text className="p-4 text-xs text-red-600">Could not load bookings.</Text>
        ) : appointments.length === 0 ? (
          <Text className="p-4 text-xs text-slate-500">
            No bookings scheduled for this day.
          </Text>
        ) : (
          appointments.map((appt, index) => (
            <Pressable
              key={appt.id}
              onPress={() => router.push(`/job/${appt.id}`)}
              accessibilityLabel={`Open booking for ${appt.customer}`}
            >
              <AppointmentRow
                appt={appt}
                isLast={index === appointments.length - 1}
              />
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}
