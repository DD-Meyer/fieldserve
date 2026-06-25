import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import "../../global.css";
import AppHeader from "../../components/AppHeader";
import FeatureCard from "../../components/FeatureCard";
import StatCard from "../../components/StatCard";
import UpcomingJobRow, { type UpcomingJob } from "../../components/UpcomingJobRow";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useJobs, type Job } from "../../lib/hooks/useJobs";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaVIew } from "react-native-safe-area-context";

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
  const { data, isLoading, error } = useJobs({
    date: "today",
    ordering: "scheduled_at",
  });

  const jobs = data?.results ?? [];
  const total = moneyTotal(jobs);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="FieldServe CRM" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
        <View className="flex-row gap-3">
          <StatCard
            label="Jobs Today"
            value={isLoading ? "—" : String(jobs.length)}
            delta={isLoading ? "Loading…" : "Live"}
          />
          <StatCard
            label="Revenue"
            value={isLoading ? "—" : `$${total.toFixed(0)}`}
            delta={isLoading ? "Loading…" : "Sum of today's jobs"}
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
          {isLoading ? (
            <View className="p-6 items-center">
              <ActivityIndicator />
            </View>
          ) : error ? (
            <View className="p-6 items-center">
              <Text className="text-xs text-red-600">Could not load jobs.</Text>
            </View>
          ) : jobs.length === 0 ? (
            <View className="p-6 items-center">
              <Text className="text-xs text-slate-500">No jobs scheduled today.</Text>
            </View>
          ) : (
            jobs.map((j: Job) => <UpcomingJobRow key={j.id} job={toUpcoming(j)} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}