import { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import "../global.css";

import AppHeader from "@/components/AppHeader";
import {
  ComparisonBars,
  HorizontalBars,
  SegmentedBreakdown,
} from "@/components/insights/InsightCharts";
import { useRefresh } from "@/hooks/useRefresh";
import {
  buildChurnInsights,
  buildDemandInsights,
  buildInspectionInsights,
  buildSchedulerInsights,
} from "@/lib/liveInsightsSummary";
import { useCurrentBusiness } from "@/lib/hooks/useBusiness";
import { useChurnScores } from "@/lib/hooks/useChurn";
import { useCustomers } from "@/lib/hooks/useCustomers";
import { useInspections } from "@/lib/hooks/useInspections";
import { useJobs, useRoadRoute, type Job, type RoutePoint } from "@/lib/hooks/useJobs";
import { useHeatmap, useOptimizedSchedule } from "@/lib/hooks/usePredictions";
import { useServices } from "@/lib/hooks/useServices";

const SafeAreaView = styled(RNSafeAreaView);

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

function formatMinutes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0m";
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function Card({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
      <Text className="text-base font-bold text-slate-900">{title}</Text>
      {detail ? <Text className="text-xs text-slate-500 mt-1 mb-4 leading-5">{detail}</Text> : <View className="mb-4" />}
      {children}
    </View>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View className="flex-1 rounded-xl bg-slate-50 border border-slate-100 p-3">
      <Text className="text-[11px] text-slate-500" numberOfLines={1}>{label}</Text>
      <Text className="text-lg font-bold text-slate-900 mt-1" numberOfLines={1}>{value}</Text>
      <Text className="text-[10px] text-slate-500 mt-1 leading-4" numberOfLines={2}>{detail}</Text>
    </View>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <Text className="text-xs text-slate-500 leading-5">{text}</Text>;
}

function hasLatLng(job: Job): job is Job & { latitude: number; longitude: number } {
  return typeof job.latitude === "number" && typeof job.longitude === "number";
}

export default function AiInsightsScreen() {
  const business = useCurrentBusiness();
  const customers = useCustomers();
  const churnScores = useChurnScores();
  const services = useServices();
  const inspections = useInspections();
  const allJobs = useJobs({ ordering: "scheduled_at" });
  const heatmapAll = useHeatmap({ range: "all", weight_by: "count" });

  const liveJobs = useMemo(() => allJobs.data?.results ?? [], [allJobs.data?.results]);
  const schedulableJobs = useMemo(
    () => liveJobs
      .filter((job) => job.status !== "cancelled")
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [liveJobs],
  );
  const locatedJobs = useMemo(
    () => schedulableJobs.filter(hasLatLng),
    [schedulableJobs],
  );
  const depot = useMemo<RoutePoint | null>(() => {
    if (business.data?.depot_latitude == null || business.data?.depot_longitude == null) return null;
    return {
      latitude: business.data.depot_latitude,
      longitude: business.data.depot_longitude,
    };
  }, [business.data]);
  const routePoints = useMemo<RoutePoint[]>(() => {
    const points = locatedJobs.map((job) => ({ latitude: job.latitude, longitude: job.longitude }));
    return depot ? [depot, ...points] : points;
  }, [depot, locatedJobs]);
  const roadRoute = useRoadRoute(routePoints);
  const optimizedSchedule = useOptimizedSchedule({
    depot,
    job_ids: locatedJobs.map((job) => job.id),
  });

  const churn = useMemo(
    () => buildChurnInsights(churnScores.data?.results ?? [], customers.data?.results ?? []),
    [churnScores.data?.results, customers.data?.results],
  );
  const demand = useMemo(
    () => buildDemandInsights(heatmapAll.data, services.data?.results ?? [], liveJobs),
    [heatmapAll.data, services.data?.results, liveJobs],
  );
  const inspectionSummary = useMemo(
    () => buildInspectionInsights(inspections.data?.results ?? []),
    [inspections.data?.results],
  );
  const scheduler = useMemo(
    () => buildSchedulerInsights(schedulableJobs, roadRoute.data, optimizedSchedule.data),
    [schedulableJobs, roadRoute.data, optimizedSchedule.data],
  );

  const loading = customers.isLoading || churnScores.isLoading || allJobs.isLoading;
  const { refreshing, onRefresh } = useRefresh([
    business.refetch,
    customers.refetch,
    churnScores.refetch,
    services.refetch,
    inspections.refetch,
    allJobs.refetch,
    heatmapAll.refetch,
    roadRoute.refetch,
    optimizedSchedule.refetch,
  ]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="AI Insights" back={true} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="bg-slate-900 rounded-2xl p-5 mb-4">
          <Text className="text-slate-300 text-xs">Live performance dashboard</Text>
          <Text className="text-white text-2xl font-bold mt-1">AI intelligence overview</Text>
          <Text className="text-slate-300 text-xs leading-5 mt-2">
            Connected to live all-time churn scores, demand predictions, inspections, services, bookings, and route optimisation.
          </Text>
          {loading ? <ActivityIndicator color="white" style={{ marginTop: 16 }} /> : null}
        </View>

        <View className="flex-row gap-3 mb-3">
          <Kpi label="At risk" value={String(churn.highRisk)} detail={`${churn.scoredCustomers} scored customers`} />
          <Kpi label="Revenue risk" value={formatMoney(churn.revenueAtRisk)} detail="Probability weighted" />
        </View>
        <View className="flex-row gap-3 mb-4">
          <Kpi label="Demand upside" value={formatMoney(demand.opportunityRevenue)} detail={demand.strongestZone} />
          <Kpi label="Time saved" value={formatMinutes(scheduler.minutesSaved)} detail={`${scheduler.jobCount} all-time located jobs`} />
        </View>

        <Card title="Customer churn analysis" detail={churn.reasoning}>
          {churn.scoredCustomers ? (
            <>
              <SegmentedBreakdown items={[
                { label: "Low", value: churn.lowRisk, color: "#16a34a" },
                { label: "Medium", value: churn.mediumRisk, color: "#d97706" },
                { label: "High", value: churn.highRisk, color: "#dc2626" },
                { label: "Unscored", value: churn.unscored, color: "#94a3b8" },
              ]} />
              <View className="mt-4 gap-3">
                {churn.topCustomers.map((customer) => (
                  <View key={customer.id} className="rounded-xl bg-slate-50 p-3">
                    <View className="flex-row justify-between gap-3">
                      <Text className="text-sm font-semibold text-slate-900 flex-1" numberOfLines={1}>{customer.name}</Text>
                      <Text className="text-sm font-bold text-red-600">{Math.round(customer.probability * 100)}%</Text>
                    </View>
                    <Text className="text-xs text-slate-500 mt-1 leading-4">{customer.reason}</Text>
                    <Text className="text-[11px] text-slate-400 mt-1">Exposure {formatMoney(customer.exposure)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : <EmptyMessage text="No churn scores are available yet. Run churn scoring once customers have booking history." />}
        </Card>

        <Card title="Demand heatmap predictions" detail={demand.reasoning}>
          <View className="gap-3">
            {demand.zones.map((zone) => (
              <View key={zone.name} className="rounded-xl bg-orange-50 border border-orange-100 p-3">
                <View className="flex-row justify-between gap-3">
                  <Text className="text-sm font-semibold text-orange-950 flex-1" numberOfLines={1}>{zone.name}</Text>
                  <Text className="text-xs font-bold text-orange-700">{Math.round(zone.score * 100)} score</Text>
                </View>
                <Text className="text-xs text-orange-800 mt-1 leading-4">{zone.detail}</Text>
              </View>
            ))}
            {demand.zones.length === 0 ? (
              <EmptyMessage text="Not enough all-time located customer data to rank demand areas yet." />
            ) : null}
          </View>
        </Card>

        <Card title="Suggested services and revenue opportunity" detail="Recommendations combine demand-zone service mix, active catalogue prices, and recent booking values.">
          {demand.serviceSuggestions.length ? (
            <HorizontalBars items={demand.serviceSuggestions.map((item) => ({
              label: item.name,
              value: item.estimatedRevenue,
              color: "#2563eb",
            }))} />
          ) : <EmptyMessage text="Demand zones do not have enough service mix yet to suggest services." />}
          <View className="mt-4 gap-2">
            {demand.serviceSuggestions.map((item) => (
              <Text key={item.name} className="text-xs text-slate-500 leading-5">
                <Text className="font-semibold text-slate-800">{item.name}: </Text>
                {item.bookings} zone bookings · {formatMoney(item.estimatedRevenue)} estimated revenue opportunity. {item.reason}
              </Text>
            ))}
          </View>
        </Card>

        <Card title="Vehicle inspection breakdown" detail={inspectionSummary.reasoning}>
          <View className="flex-row gap-3 mb-4">
            <Kpi label="Analysed" value={String(inspectionSummary.completed)} detail={`${inspectionSummary.inspections} total captures`} />
            <Kpi label="Issues" value={String(inspectionSummary.totalDamages)} detail={`${Math.round(inspectionSummary.averageConfidence * 100)}% avg confidence`} />
          </View>
          <Text className="text-xs font-semibold text-slate-700 mb-2">Damage types</Text>
          <HorizontalBars items={inspectionSummary.byType.slice(0, 5)} />
          <Text className="text-xs font-semibold text-slate-700 mt-4 mb-2">Detection confidence</Text>
          <SegmentedBreakdown items={inspectionSummary.byConfidence} />
          <Text className="text-xs font-semibold text-slate-700 mt-4 mb-2">Affected regions</Text>
          <HorizontalBars items={inspectionSummary.byRegion.slice(0, 5)} />
        </Card>

        <Card title="Smart scheduler impact" detail={scheduler.reasoning}>
          {scheduler.usualMinutes > 0 && scheduler.optimizedMinutes > 0 ? (
            <ComparisonBars
              firstLabel="Usual route"
              firstValue={scheduler.usualMinutes}
              secondLabel="Optimized route"
              secondValue={scheduler.optimizedMinutes}
            />
          ) : <EmptyMessage text="Add a depot and at least two located jobs to compare all-time scheduled-order travel with the optimizer." />}
          <View className="flex-row gap-3 mt-4">
            <Kpi label="Saved" value={formatMinutes(scheduler.minutesSaved)} detail={`${Math.round(scheduler.percentSaved * 100)}% travel cut`} />
            <Kpi label="Distance" value={`${scheduler.optimizedDistanceKm} km`} detail={`Usual ${scheduler.usualDistanceKm} km`} />
          </View>
          {scheduler.excludedJobs ? (
            <Text className="text-[11px] text-amber-700 mt-3 leading-4">
              {scheduler.excludedJobs} job{scheduler.excludedJobs === 1 ? "" : "s"} excluded because a saved location is missing.
            </Text>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
