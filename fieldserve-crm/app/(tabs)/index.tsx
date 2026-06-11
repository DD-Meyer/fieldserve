import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import "../../global.css";
import AppHeader from "../../components/AppHeader";
import FeatureCard from "../../components/FeatureCard";
import StatCard from "../../components/StatCard";
import UpcomingJobRow, { type UpcomingJob } from "../../components/UpcomingJobRow";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaVIew} from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaVIew);

const UPCOMING: UpcomingJob[] = [
  {
    id: 1,
    time: "09:00",
    customer: "Sarah Johnson",
    service: "Full Detail · Sedan",
    location: "12 Riverside Ave",
  },
  {
    id: 2,
    time: "11:30",
    customer: "Marcus Lee",
    service: "Exterior Wash",
    location: "Apt 4B, 88 Pine St",
  },
  {
    id: 3,
    time: "14:00",
    customer: "Priya Patel",
    service: "Interior Detail · SUV",
    location: "31 Oak Lane",
  },
  {
    id: 4,
    time: "16:15",
    customer: "Tom Becker",
    service: "Ceramic Coating",
    location: "204 Market Sq",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="FieldServe CRM" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
        <View className="flex-row gap-3">
          <StatCard label="Jobs Today" value="8" delta="+2 vs yesterday" />
          <StatCard label="Revenue" value="$1,240" delta="+12% this week" />
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
          {UPCOMING.map((job) => (
            <UpcomingJobRow key={job.id} job={job} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}