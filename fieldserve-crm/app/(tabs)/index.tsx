import { useMemo, useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import "../../global.css";
import AppHeader, {
  HOME_HEADER_EXTRA_HEIGHT,
} from "../../components/AppHeader";
import BookingCalendarCard from "../../components/home/BookingCalendarCard";
import WeeklyRevenueCard from "../../components/home/WeeklyRevenueCard";
import { addDays, dateKey, monthBounds, startOfWeek, weeklyRevenue } from "../../components/home/dashboardData";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useRefresh } from "@/hooks/useRefresh";
import { useJobs } from "../../lib/hooks/useJobs";
import {
  useNotificationSocket,
  useUnreadNotificationCount,
} from "../../lib/hooks/useNotifications";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaVIew } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaVIew);

function moneyTotal(jobs: { price: string | number | null }[]): number {
  return jobs.reduce((sum, j) => sum + (Number(j.price) || 0), 0);
}

export default function HomeScreen() {
  const router = useRouter();
  useNotificationSocket();
  const { data: unreadNotificationCount = 0 } = useUnreadNotificationCount();
  const tabBarSpace = useTabBarSpace();
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Load today's jobs
  const {
    data: todayData,
    isLoading: todayLoading,
    refetch: refetchToday,
  } = useJobs({
    date: "today",
    ordering: "scheduled_at"
  });

  const { from: monthStart, to: monthEnd } = useMemo(
    () => monthBounds(calendarMonth),
    [calendarMonth],
  );
  const weekStart = useMemo(() => startOfWeek(new Date()), []);

  const {
    data: monthData,
    refetch: refetchMonth,
  } = useJobs({
    date_from: dateKey(monthStart),
    date_to: dateKey(monthEnd),
    ordering: "scheduled_at"
  });

  const { data: revenueData, refetch: refetchRevenue } = useJobs({
    date_from: dateKey(addDays(weekStart, -7)),
    date_to: dateKey(addDays(weekStart, 6)),
    ordering: "scheduled_at",
  });

  const todayJobs = useMemo(() => todayData?.results ?? [], [todayData?.results]);
  const todayRevenue = moneyTotal(todayJobs);
  const monthJobs = useMemo(() => monthData?.results ?? [], [monthData?.results]);
  const revenueJobs = useMemo(() => revenueData?.results ?? [], [revenueData?.results]);
  const currentWeekRevenue = useMemo(
    () => weeklyRevenue(revenueJobs, weekStart),
    [revenueJobs, weekStart],
  );
  const previousWeekTotal = useMemo(
    () => weeklyRevenue(revenueJobs, addDays(weekStart, -7)).reduce((sum, point) => sum + point.value, 0),
    [revenueJobs, weekStart],
  );

  const { refreshing, onRefresh } = useRefresh([refetchToday, refetchMonth, refetchRevenue]);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader
        home
        title=""
        scrollY={scrollY}
        stats={[
          { label: "Jobs Today", value: todayLoading ? "—" : String(todayJobs.length) },
          { label: "Today's Revenue", value: todayLoading ? "—" : `$${todayRevenue.toFixed(0)}` },
          { label: "Pending", value: todayLoading ? "—" : String(todayJobs.filter(job => job.status === "pending").length) },
        ]}
        notificationCount={unreadNotificationCount}
        onNotificationPress={() => router.push("/notifications" as any)}
      />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: HOME_HEADER_EXTRA_HEIGHT + 16,
          paddingHorizontal: 16,
          paddingBottom: tabBarSpace,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={HOME_HEADER_EXTRA_HEIGHT}
          />
        }
      >
        <WeeklyRevenueCard points={currentWeekRevenue} previousTotal={previousWeekTotal} />

        <View className="mt-6 mb-3 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-slate-900">Booking Calendar</Text>
          <Pressable onPress={() => router.push("/schedule")} accessibilityLabel="View schedule">
            <Text className="text-xs font-semibold text-blue-600">View schedule</Text>
          </Pressable>
        </View>
        <BookingCalendarCard
          month={calendarMonth}
          jobs={monthJobs}
          selectedDate={selectedDate}
          onMonthChange={setCalendarMonth}
          onSelectDate={setSelectedDate}
        />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}