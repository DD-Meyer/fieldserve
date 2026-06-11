import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import CustomerChurnCard, {
  type ChurnCustomer,
} from "../../components/CustomerChurnCard";
import FilterPills from "../../components/FilterPills";
import { levelFromProb } from "../../components/RiskBadge";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaVIew} from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaVIew);

const PILLS = [
  { key: "all", label: "All" },
  { key: "high", label: "High Risk" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low Risk" },
];

const CUSTOMERS: ChurnCustomer[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    lastVisit: "92 days ago",
    probability: 0.86,
    recencyDays: 92,
    frequency: 2,
    monetary: 240,
  },
  {
    id: 2,
    name: "Marcus Lee",
    lastVisit: "45 days ago",
    probability: 0.62,
    recencyDays: 45,
    frequency: 4,
    monetary: 580,
  },
  {
    id: 3,
    name: "Priya Patel",
    lastVisit: "12 days ago",
    probability: 0.18,
    recencyDays: 12,
    frequency: 9,
    monetary: 1420,
  },
  {
    id: 4,
    name: "Tom Becker",
    lastVisit: "120 days ago",
    probability: 0.81,
    recencyDays: 120,
    frequency: 1,
    monetary: 95,
  },
  {
    id: 5,
    name: "Elena Rossi",
    lastVisit: "5 days ago",
    probability: 0.09,
    recencyDays: 5,
    frequency: 12,
    monetary: 2150,
  },
  {
    id: 6,
    name: "David Kim",
    lastVisit: "61 days ago",
    probability: 0.47,
    recencyDays: 61,
    frequency: 3,
    monetary: 420,
  },
];

export default function Customers() {
  const [active, setActive] = useState("all");
  const tabBarSpace = useTabBarSpace();

  const filtered = useMemo(() => {
    if (active === "all") return CUSTOMERS;
    return CUSTOMERS.filter((c) => levelFromProb(c.probability) === active);
  }, [active]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    CUSTOMERS.forEach((cust) => {
      c[levelFromProb(cust.probability)]++;
    });
    return c;
  }, []);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="Customers" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
        <Text className="text-xl font-bold text-slate-900">
          Customer Churn Analysis
        </Text>
        <Text className="text-xs text-slate-500 mt-1 mb-4">
          AI-powered predictions based on RFM model
        </Text>

        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
            <Text className="text-lg font-bold text-red-600">{counts.high}</Text>
            <Text className="text-[11px] text-slate-500">High</Text>
          </View>
          <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
            <Text className="text-lg font-bold text-amber-600">
              {counts.medium}
            </Text>
            <Text className="text-[11px] text-slate-500">Medium</Text>
          </View>
          <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
            <Text className="text-lg font-bold text-green-600">{counts.low}</Text>
            <Text className="text-[11px] text-slate-500">Low</Text>
          </View>
        </View>

        <View className="mb-4">
          <FilterPills pills={PILLS} active={active} onChange={setActive} />
        </View>

        {filtered.length === 0 ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center">
            <Text className="text-slate-500 text-sm">No customers in this group.</Text>
          </View>
        ) : (
          filtered.map((c) => <CustomerChurnCard key={c.id} customer={c} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}