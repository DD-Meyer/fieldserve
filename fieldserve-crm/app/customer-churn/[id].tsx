import { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import RiskBadge, { type RiskLevel } from "../../components/RiskBadge";
import { useRefresh } from "@/hooks/useRefresh";
import { buildChurnReasoning, type ChurnReason } from "../../lib/churnReasoning";
import {
  useChurnHistory,
  useLatestChurnScore,
  type ChurnScore,
} from "../../lib/hooks/useChurn";
import { useCustomer } from "../../lib/hooks/useJobs";

const SafeAreaView = styled(RNSafeAreaView);

const BUCKET_TO_LEVEL: Record<ChurnScore["risk_bucket"], RiskLevel> = {
  Low: "low",
  Medium: "medium",
  High: "high",
};

const IMPACT_TONES: Record<ChurnReason["impact"], { bg: string; text: string; label: string }> = {
  risk: { bg: "bg-red-50", text: "text-red-700", label: "Raises risk" },
  protective: { bg: "bg-green-50", text: "text-green-700", label: "Lowers risk" },
  neutral: { bg: "bg-slate-50", text: "text-slate-600", label: "Context" },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
      {children}
    </View>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <Text className="text-sm font-bold text-slate-900">{title}</Text>
      <Text className="text-xs text-slate-500 mt-2 leading-5">{detail}</Text>
    </Card>
  );
}

function SignalCard({ signal }: { signal: ChurnReason }) {
  const tone = IMPACT_TONES[signal.impact];
  return (
    <View className={`rounded-xl p-3 mb-3 ${tone.bg}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-bold text-slate-900">{signal.title}</Text>
          <Text className="text-xs text-slate-600 mt-1 leading-5">
            {signal.detail}
          </Text>
        </View>
        <View className="items-end">
          <Text className={`text-[10px] font-bold ${tone.text}`}>{tone.label}</Text>
          <Text className="text-xs font-semibold text-slate-900 mt-1">
            {signal.value}
          </Text>
        </View>
      </View>
    </View>
  );
}

function FeatureRow({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <View className="py-3 border-b border-slate-100">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="text-sm font-semibold text-slate-900 flex-1">{label}</Text>
        <Text className="text-sm font-bold text-slate-900 text-right">{value}</Text>
      </View>
      <Text className="text-[11px] text-slate-500 mt-1 leading-4">
        {description}
      </Text>
    </View>
  );
}

export default function CustomerChurnAnalysis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = id ? Number(id) : null;

  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
    refetch: refetchCustomer,
  } = useCustomer(customerId);
  const {
    data: latestScorePage,
    isLoading: scoreLoading,
    error: scoreError,
    refetch: refetchScore,
  } = useLatestChurnScore(customerId);
  const { data: history, refetch: refetchHistory } = useChurnHistory(customerId);

  const { refreshing, onRefresh } = useRefresh([
    refetchCustomer,
    refetchScore,
    refetchHistory,
  ]);

  const latestScore = latestScorePage?.results?.[0] ?? history?.[0];
  const reasoning = useMemo(
    () => buildChurnReasoning(latestScore),
    [latestScore],
  );

  if (!customerId) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <AppHeader title="Churn analysis" back={true} />
        <View className="p-6">
          <Text className="text-slate-500">Missing customer id.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (customerLoading || scoreLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <AppHeader title="Churn analysis" back={true} />
        <View className="p-6 items-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (customerError || !customer) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <AppHeader title="Churn analysis" back={true} />
        <View className="p-6">
          <Text className="text-xs text-red-600">Could not load customer.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="Churn analysis" back={true} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {scoreError ? (
          <EmptyState
            title="Could not load churn analysis"
            detail="Pull to refresh or try again after the latest churn scoring run completes."
          />
        ) : null}

        {!latestScore ? (
          <EmptyState
            title="No churn score yet"
            detail="This customer needs booking history before FieldServe can calculate churn risk and show the reasoning behind it."
          />
        ) : (
          <>
            <Card>
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text className="text-xs text-slate-500">Customer</Text>
                  <Text className="text-xl font-bold text-slate-900 mt-1">
                    {customer.full_name}
                  </Text>
                  <Text className="text-xs text-slate-500 mt-1">
                    Scored {new Date(latestScore.scored_at).toLocaleString()}
                  </Text>
                </View>
                <RiskBadge
                  level={BUCKET_TO_LEVEL[latestScore.risk_bucket]}
                  probability={Number(latestScore.probability)}
                />
              </View>
              <View className="mt-4 pt-4 border-t border-slate-100">
                <Text className="text-xs text-slate-500">Churn probability</Text>
                <Text className="text-3xl font-bold text-slate-900 mt-1">
                  {Math.round(Number(latestScore.probability) * 100)}%
                </Text>
                <Text className="text-[11px] text-slate-500 mt-2">
                  {latestScore.model_name} · {latestScore.feature_set} · {latestScore.model_version}
                </Text>
              </View>
            </Card>

            <Card>
              <Text className="text-sm font-bold text-slate-900">
                Why this customer is at risk
              </Text>
              <Text className="text-xs text-slate-500 mt-2 mb-3 leading-5">
                {reasoning.summary}
              </Text>
              {reasoning.reasons.length === 0 ? (
                <Text className="text-xs text-slate-500">
                  No standout signals were available in the saved feature snapshot.
                </Text>
              ) : (
                reasoning.reasons.map((signal) => (
                  <SignalCard key={signal.key} signal={signal} />
                ))
              )}
            </Card>

            <Card>
              <Text className="text-sm font-bold text-slate-900">
                Model inputs used
              </Text>
              <Text className="text-xs text-slate-500 mt-2 mb-1 leading-5">
                These are the exact feature values saved with the latest score.
              </Text>
              {reasoning.featureRows.map((feature) => (
                <FeatureRow
                  key={feature.key}
                  label={feature.label}
                  value={feature.value}
                  description={feature.description}
                />
              ))}
            </Card>

            <Card>
              <Text className="text-sm font-bold text-slate-900 mb-2">
                Score history
              </Text>
              {!history || history.length === 0 ? (
                <Text className="text-xs text-slate-500">No prior scores.</Text>
              ) : (
                history.slice(0, 20).map((score) => (
                  <View
                    key={score.id}
                    className="flex-row items-center justify-between py-2 border-b border-slate-100"
                  >
                    <Text className="text-xs text-slate-700">
                      {new Date(score.scored_at).toLocaleString()}
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-sm font-semibold text-slate-900 mr-2">
                        {Math.round(Number(score.probability) * 100)}%
                      </Text>
                      <RiskBadge
                        level={BUCKET_TO_LEVEL[score.risk_bucket]}
                        probability={Number(score.probability)}
                      />
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}