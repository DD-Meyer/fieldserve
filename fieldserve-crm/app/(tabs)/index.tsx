import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import "../../global.css";
import AppHeader from "../../components/AppHeader";
import FeatureCard from "../../components/FeatureCard";
import StatCard from "../../components/StatCard";
import HomeBackground from "../../components/HomeBackground";
import UpcomingJobRow, { type UpcomingJob } from "../../components/UpcomingJobRow";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useJobs, type Job } from "../../lib/hooks/useJobs";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaVIew } from "react-native-safe-area-context";
import { isLoading } from "expo-font";
import { Background } from "@react-navigation/elements";

const SafeAreaView = styled(RNSafeAreaVIew);

function toUpcoming(j: Job): UpcomingJob {
  const d = new Date(j.scheduled_at);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    id: j.id,
    time,
    customer: j.customer_name || `Customer #${j.customer}`,
    service: j.service_type,
    location: j.address || j.customer_address || "",
  };
}

function moneyTotal(jobs: Job[]): number {
  return jobs.reduce((sum, j) => sum + (Number(j.price) || 0), 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();

  // Load today's jobs
  const {
    data: todayData,
    isLoading: todayLoading,
    error: todayError
  } = useJobs({
    date: "today",
    ordering: "scheduled_at"
  });

  // Load all jobs for total count
  const {
    data: lastWeekData,
    isLoading: lastWeekLoading,
    error: lastWeekError
  } = useJobs({
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split("T")[0];
    })(), // 7 days ago in the format "YYYY-MM-DD"
    ordering: "scheduled_at"
  });

  const todayJobs = todayData?.results ?? [];
  const lastWeekJobs = lastWeekData?.results ?? [];

  const todayRevenue = moneyTotal(todayJobs);
  const totalRevenue = moneyTotal(lastWeekJobs);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="FieldServe CRM" />

      

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
        <HomeBackground />
        <View className="flex-row gap-3 justify-between">
          <StatCard
            label="Jobs Today"
            value={todayLoading ? "—" : String(todayJobs.length)}
            delta={todayLoading ? "Loading…" : "Live"}
          />
          <StatCard
            label="Revenue this week"
            value={todayLoading ? "—" : `$${todayRevenue.toFixed(0)}`}
            delta={todayLoading ? "Loading…" : "Sum of today's revenue"}
          />
        </View>
        <View className="flex-row gap-3 mt-3 justify-between">
          <StatCard
            label="Last Week's Jobs"
            value={lastWeekLoading ? "—" : String(lastWeekJobs.length)}
            delta={lastWeekLoading ? "Loading…" : "Live"}
          />
          <StatCard
            label="Last week's Revenue"
            value={lastWeekLoading ? "—" : `$${totalRevenue.toFixed(0)}`}
            delta={lastWeekLoading ? "Loading…" : "Sum of total revenue"}
          />
        </View>

        <Text className="mt-6 mb-3 text-base font-semibold text-slate-900">
          AI Insights
        </Text>
        <View className="gap-3">
          <FeatureCard
            tone="red"
            glyph="⚠"
            title="Churn Risk"
            description="3 customers at high risk of churning based on RFM analysis."
            cta="Review customers"
            onPress={() => router.push("/(tabs)/customers")}
          />
          <FeatureCard
            tone="blue"
            glyph="◷"
            title="Smart Scheduler"
            description="Reorder today's route to save ~1.2 hours of travel time."
            cta="Optimise schedule"
            onPress={() => router.push("/(tabs)/schedule")}
          />
          <FeatureCard
            tone="green"
            glyph="◉"
            title="Demand Heat Map"
            description="Two new opportunity zones detected this week."
            cta="View map"
            onPress={() => router.push("/(tabs)/map")}
          />
        </View>

        <View className="mt-6 mb-2 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-slate-900">Upcoming Jobs</Text>
          <Text className="text-xs text-slate-500">Today</Text>
        </View>
        <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {todayLoading ? (
            <View className="p-6 items-center">
              <ActivityIndicator />
            </View>
          ) : todayError ? (
            <View className="p-6 items-center">
              <Text className="text-xs text-red-600">Could not load jobs.</Text>
            </View>
          ) : todayJobs.length === 0 ? (
            <View className="p-6 items-center">
              <Text className="text-xs text-slate-500">No jobs scheduled today.</Text>
            </View>
          ) : (
            todayJobs.map((j: Job) => <UpcomingJobRow key={j.id} job={toUpcoming(j)} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}