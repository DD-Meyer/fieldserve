import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import CustomerChurnCard, {
  type ChurnCustomer,
} from "../../components/CustomerChurnCard";
import FilterPills from "../../components/FilterPills";
import { levelFromProb, type RiskLevel } from "../../components/RiskBadge";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import {
  useChurnScores,
  type ChurnScore,
} from "../../lib/hooks/useChurn";
import {
  useCreateCustomer,
  useCustomers,
  type Customer,
} from "../../lib/hooks/useCustomers";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaVIew } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaVIew);

const PILLS = [
  { key: "all", label: "All" },
  { key: "high", label: "High Risk" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low Risk" },
];

const BUCKET_TO_LEVEL: Record<ChurnScore["risk_bucket"], RiskLevel> = {
  Low: "low",
  Medium: "medium",
  High: "high",
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function formatLastVisit(c: Customer, snapRecency: number | null): string {
  const recency = snapRecency ?? daysSince(c.last_seen_at);
  if (recency == null) return "Never";
  return `${recency} day${recency === 1 ? "" : "s"} ago`;
}

function toChurnRow(c: Customer, score?: ChurnScore): ChurnCustomer & {
  level: RiskLevel;
  scored: boolean;
} {
  if (score) {
    const snap = score.feature_snapshot ?? {};
    const recency =
      typeof snap.recency_days === "number"
        ? Math.round(snap.recency_days)
        : daysSince(c.last_seen_at) ?? 0;
    return {
      id: c.id,
      name: c.full_name,
      lastVisit: formatLastVisit(c, recency),
      probability: Number(score.probability),
      level: BUCKET_TO_LEVEL[score.risk_bucket],
      recencyDays: recency,
      frequency:
        typeof snap.freq_12m === "number" ? Math.round(snap.freq_12m) : 0,
      monetary:
        typeof snap.total_spend_12m === "number"
          ? Math.round(snap.total_spend_12m)
          : 0,
      scored: true,
    };
  }

  const recency = daysSince(c.last_seen_at) ?? 999;
  return {
    id: c.id,
    name: c.full_name,
    lastVisit: c.last_seen_at ? `${recency} days ago` : "Never",
    probability: 0,
    level: "low",
    recencyDays: recency,
    frequency: 0,
    monetary: 0,
    scored: false,
  };
}

export default function Customers() {
  const [active, setActive] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();

  const {
    data: customerData,
    isLoading: customersLoading,
    error: customersError,
    refetch,
  } = useCustomers();
  const { data: churnData, isLoading: churnLoading } = useChurnScores();

  const scoreByCustomer = useMemo(() => {
    const map = new Map<number, ChurnScore>();
    (churnData?.results ?? []).forEach((s) => map.set(s.customer, s));
    return map;
  }, [churnData]);

  const rows = useMemo(
    () =>
      (customerData?.results ?? []).map((c) =>
        toChurnRow(c, scoreByCustomer.get(c.id)),
      ),
    [customerData, scoreByCustomer],
  );

  const filtered = useMemo(() => {
    if (active === "all") return rows;
    return rows.filter((r) => r.scored && r.level === active);
  }, [active, rows]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, unscored: 0 };
    rows.forEach((r) => {
      if (!r.scored) c.unscored++;
      else c[r.level]++;
    });
    return c;
  }, [rows]);

  const modelMeta = useMemo(() => {
    const first = (churnData?.results ?? [])[0];
    if (!first) return null;
    return {
      name: first.model_name,
      featureSet: first.feature_set,
      trainedAt: first.model_version,
    };
  }, [churnData]);

  const isLoading = customersLoading || churnLoading;

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="Customers" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-slate-900">
            Customer Churn Analysis
          </Text>
          <Pressable
            onPress={() => setShowAdd(true)}
            className="bg-blue-600 rounded-full px-3 py-1.5"
          >
            <Text className="text-white text-xs font-semibold">+ Add</Text>
          </Pressable>
        </View>
        <Text className="text-xs text-slate-500 mt-1 mb-4">
          {modelMeta
            ? `${modelMeta.name} · ${modelMeta.featureSet} · trained ${modelMeta.trainedAt}`
            : "No churn scores yet — run `score_churn` on the backend."}
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
          <View className="flex-1 bg-white rounded-xl border border-slate-200 p-3 items-center">
            <Text className="text-lg font-bold text-slate-500">
              {counts.unscored}
            </Text>
            <Text className="text-[11px] text-slate-500">Unscored</Text>
          </View>
        </View>

        <View className="mb-4">
          <FilterPills pills={PILLS} active={active} onChange={setActive} />
        </View>

        {isLoading ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center">
            <ActivityIndicator />
          </View>
        ) : customersError ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center">
            <Text className="text-xs text-red-600">Could not load customers.</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center">
            <Text className="text-slate-500 text-sm">
              No customers in this group.
            </Text>
          </View>
        ) : (
          filtered.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/customer/${c.id}`)}
            >
              <CustomerChurnCard customer={c} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <AddCustomerModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          refetch();
        }}
      />
    </SafeAreaView>
  );
}

function AddCustomerModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const create = useCreateCustomer();

  const submit = async () => {
    setErr(null);
    try {
      await create.mutateAsync({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      setFullName("");
      setEmail("");
      setPhone("");
      setAddress("");
      onCreated();
    } catch (e: any) {
      setErr(e?.message || "Could not create customer");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-slate-900">New Customer</Text>
            <Pressable onPress={onClose}>
              <Text className="text-slate-500 text-base">Close</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-slate-500 mb-1">Full name *</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Jane Doe"
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mb-3"
          />

          <Text className="text-xs text-slate-500 mb-1">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="jane@example.com"
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mb-3"
          />

          <Text className="text-xs text-slate-500 mb-1">Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+44 7700 900000"
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mb-3"
          />

          <Text className="text-xs text-slate-500 mb-1">Address</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="12 Riverside Ave, London"
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mb-3"
          />

          {err ? <Text className="text-xs text-red-600 mb-2">{err}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={create.isPending || !fullName}
            className="bg-blue-600 rounded-xl py-3.5 items-center disabled:opacity-50"
          >
            {create.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Create customer</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}