import { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import RiskBadge, { levelFromProb, type RiskLevel } from "../../components/RiskBadge";
import { useCustomer, useJobs } from "../../lib/hooks/useJobs";
import {
  useChurnHistory,
  useChurnScores,
  type ChurnScore,
} from "../../lib/hooks/useChurn";

const SafeAreaView = styled(RNSafeAreaView);

const BUCKET_TO_LEVEL: Record<ChurnScore["risk_bucket"], RiskLevel> = {
  Low: "low",
  Medium: "medium",
  High: "high",
};

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, { bg: string; text: string }> = {
    pending: { bg: "bg-slate-100", text: "text-slate-700" },
    scheduled: { bg: "bg-blue-100", text: "text-blue-700" },
    in_progress: { bg: "bg-amber-100", text: "text-amber-700" },
    completed: { bg: "bg-green-100", text: "text-green-700" },
    cancelled: { bg: "bg-red-100", text: "text-red-700" },
  };
  const t = tones[status] ?? tones.pending;
  return (
    <View className={`px-2 py-0.5 rounded-full ${t.bg}`}>
      <Text className={`text-[10px] font-semibold ${t.text}`}>
        {status.replace("_", " ")}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="text-sm text-slate-900 font-medium" numberOfLines={1}>
        {value || "—"}
      </Text>
    </View>
  );
}

export default function CustomerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const customerId = id ? Number(id) : null;

  const { data: customer, isLoading: custLoading } = useCustomer(customerId);
  const { data: jobsPage } = useJobs(
    customerId
      ? { customer: customerId, ordering: "-scheduled_at" }
      : {},
  );
  const { data: churnList } = useChurnScores();
  const { data: history } = useChurnHistory(customerId);

  const latestScore = useMemo<ChurnScore | undefined>(() => {
    if (!customerId) return undefined;
    return (churnList?.results ?? []).find((s) => s.customer === customerId);
  }, [churnList, customerId]);

  if (!customerId) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <AppHeader title="Customer" />
        <View className="p-6">
          <Text className="text-slate-500">Missing customer id.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (custLoading || !customer) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <AppHeader title="Customer" />
        <View className="p-6 items-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const jobs = jobsPage?.results ?? [];

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title={customer.full_name} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <Pressable
          onPress={() => router.back()}
          className="self-start mb-3 px-2 py-1"
        >
          <Text className="text-xs text-blue-600">← Back</Text>
        </Pressable>

        {/* Score card */}
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-slate-500">Churn risk</Text>
              <Text className="text-2xl font-bold text-slate-900 mt-1">
                {latestScore
                  ? `${Math.round(Number(latestScore.probability) * 100)}%`
                  : "—"}
              </Text>
            </View>
            {latestScore ? (
              <RiskBadge
                level={BUCKET_TO_LEVEL[latestScore.risk_bucket]}
                probability={Number(latestScore.probability)}
              />
            ) : (
              <View className="px-2.5 py-1 rounded-full bg-slate-100">
                <Text className="text-xs font-semibold text-slate-500">
                  No score yet
                </Text>
              </View>
            )}
          </View>
          {latestScore && (
            <Text className="text-[11px] text-slate-500 mt-2">
              {latestScore.model_name} · scored{" "}
              {new Date(latestScore.scored_at).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Contact info */}
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">Contact</Text>
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Phone" value={customer.phone} />
          <InfoRow label="Address" value={customer.address} />
          {customer.email ? (
            <Pressable
              onPress={() => Linking.openURL(`mailto:${customer.email}`)}
              className="mt-3 bg-blue-600 rounded-full py-2 items-center"
            >
              <Text className="text-white text-xs font-semibold">
                Email customer
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Recent jobs */}
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">
            Bookings ({jobs.length})
          </Text>
          {jobs.length === 0 ? (
            <Text className="text-xs text-slate-500">No bookings yet.</Text>
          ) : (
            jobs.slice(0, 10).map((j) => (
              <View
                key={j.id}
                className="flex-row items-center justify-between py-2 border-b border-slate-100"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-medium text-slate-900">
                    {j.service_type}
                  </Text>
                  <Text className="text-[11px] text-slate-500">
                    {new Date(j.scheduled_at).toLocaleString()}
                  </Text>
                </View>
                <StatusPill status={j.status} />
              </View>
            ))
          )}
        </View>

        {/* Score history */}
        <View className="bg-white rounded-2xl border border-slate-200 p-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">
            Score history
          </Text>
          {!history || history.length === 0 ? (
            <Text className="text-xs text-slate-500">No prior scores.</Text>
          ) : (
            history.slice(0, 20).map((s) => (
              <View
                key={s.id}
                className="flex-row items-center justify-between py-2 border-b border-slate-100"
              >
                <Text className="text-xs text-slate-700">
                  {new Date(s.scored_at).toLocaleString()}
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-sm font-semibold text-slate-900 mr-2">
                    {Math.round(Number(s.probability) * 100)}%
                  </Text>
                  <RiskBadge
                    level={BUCKET_TO_LEVEL[s.risk_bucket]}
                    probability={Number(s.probability)}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
