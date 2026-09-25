import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import BottomSheetModal from "../../components/BottomSheetModal";
import CustomerChurnCard, {
  type ChurnCustomer,
} from "../../components/CustomerChurnCard";
import SlideToConfirmButton from "../../components/SlideToConfirmButton";
import { type RiskLevel } from "../../components/RiskBadge";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useRefresh } from "@/hooks/useRefresh";
import {
  useChurnScores,
  type ChurnScore,
} from "../../lib/hooks/useChurn";
import {
  useCreateCustomer,
  useCustomers,
  type Customer,
} from "../../lib/hooks/useCustomers";
import { useCurrentBusiness } from "../../lib/hooks/useBusiness";
import { styled } from "nativewind";
import {
  SafeAreaView as RNSafeAreaVIew,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import CustomerBackground from "../../components/CustomerBackground";

const SafeAreaView = styled(RNSafeAreaVIew);

type CustomerRiskFilter = "all" | RiskLevel;

const PILLS: { key: CustomerRiskFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High Risk" },
  { key: "medium", label: "Medium Risk" },
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();

  const {
    data: customerData,
    isLoading: customersLoading,
    error: customersError,
    refetch,
  } = useCustomers();
  const {
    data: churnData,
    isLoading: churnLoading,
    refetch: refetchChurn,
  } = useChurnScores();

  const { refreshing, onRefresh } = useRefresh([refetch, refetchChurn]);

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
    const byRisk =
      active === "all" ? rows : rows.filter((r) => r.scored && r.level === active);

    if (!searchQuery.trim()) return byRisk;

    const q = searchQuery.toLowerCase();
    return byRisk.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.lastVisit.toLowerCase().includes(q),
    );
  }, [active, rows, searchQuery]);

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
  const totalCustomers = counts.high + counts.medium + counts.low + counts.unscored;
  const activePillLabel = PILLS.find((pill) => pill.key === active)?.label ?? "All";
  const filterSummary = `${activePillLabel} · ${filtered.length}/${totalCustomers}`;

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader
        title="Customer Churn Analysis"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search customers...",
        }}
        filter={{
          summary: filterSummary,
          children: (
          <View className="flex-row gap-2">
            {PILLS.map((pill) => {
              const isActive = active === pill.key;
              let numColor = "text-slate-500";
              let rippleColor = "rgba(100, 116, 139, 0.1)";

              if (pill.key === "high") {
                numColor = "text-red-600";
                rippleColor = "rgba(239, 68, 68, 0.1)";
              } else if (pill.key === "medium") {
                numColor = "text-amber-600";
                rippleColor = "rgba(245, 158, 11, 0.1)";
              } else if (pill.key === "low") {
                numColor = "text-green-600";
                rippleColor = "rgba(22, 163, 74, 0.1)";
              }

              const displayCount =
                pill.key === "all" ? totalCustomers : counts[pill.key] || 0;

              return (
                <Pressable
                  key={pill.key}
                  className={`flex-1 rounded-xl border p-3 items-center justify-center ${
                    isActive ? "border-slate-800 bg-slate-50" : "border-slate-200 bg-white"
                  }`}
                  android_ripple={{ color: rippleColor }}
                  onPress={() => setActive(pill.key)}
                >
                  <Text className={`text-lg font-bold ${numColor}`}>
                    {displayCount}
                  </Text>
                  <Text className="text-[11px] text-slate-500 text-center" numberOfLines={1}>
                    {pill.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: tabBarSpace,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Background banner */}
        <View className="mb-6">
          <CustomerBackground />
        </View>

        <Text className="text-xs text-slate-500 mb-4">
          {modelMeta
            ? `${modelMeta.name} · ${modelMeta.featureSet} · trained ${modelMeta.trainedAt}`
            : "No churn scores yet! Run `score_churn` on the backend."}
        </Text>

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

      <SlideToConfirmButton
        label="Slide to add customer"
        onComplete={() => setShowAdd(true)}
        bottomOffset={tabBarSpace}
      />

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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const create = useCreateCustomer();
  const { data: business } = useCurrentBusiness();
  const isMobileBusiness = business?.industry_mode === "mobile";
  const insets = useSafeAreaInsets();

  const submit = async () => {
    setErr(null);
    if (isMobileBusiness && (!address.trim() || latitude == null || longitude == null)) {
      setErr("Select the customer's address from the search results.");
      return;
    }
    try {
      await create.mutateAsync({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        latitude,
        longitude,
      });
      setFullName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setLatitude(null);
      setLongitude(null);
      onCreated();
    } catch (e: any) {
      setErr(e?.message || "Could not create customer");
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View
        className="bg-white rounded-t-3xl p-5"
        style={{ paddingBottom: insets.bottom + 20 }}
      >
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-bold text-slate-900">New Customer</Text>
          <Pressable onPress={onClose}>
            <Text className="text-slate-500 text-base">Close</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
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
          {isMobileBusiness ? (
            <View className="mb-3" style={{ position: "relative", zIndex: 1000, elevation: 1000 }}>
              <GooglePlacesAutocomplete
                placeholder="Search for the customer's address"
                fetchDetails={true}
                disableScroll={true}
                minLength={2}
                debounce={300}
                onPress={(data, details = null) => {
                  const selectedLatitude = details?.geometry?.location?.lat;
                  const selectedLongitude = details?.geometry?.location?.lng;
                  if (selectedLatitude == null || selectedLongitude == null) return;
                  setAddress(data.description);
                  setLatitude(selectedLatitude);
                  setLongitude(selectedLongitude);
                }}
                query={{
                  key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                  language: "en",
                  types: "address",
                }}
                styles={{
                  container: {
                    flex: 0,
                    width: "100%",
                    zIndex: 1000,
                    flexDirection: "column-reverse",
                  },
                  textInput: {
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    height: 48,
                    color: "#0f172a",
                    fontSize: 14,
                  },
                  listView: {
                    position: "absolute",
                    bottom: 52,
                    left: 0,
                    right: 0,
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                    backgroundColor: "#ffffff",
                    elevation: 1001,
                    zIndex: 9999,
                    maxHeight: 180,
                  },
                }}
              />
              {latitude != null && longitude != null ? (
                <Text className="text-[11px] text-green-700 mt-1">
                  Location selected: {address}
                </Text>
              ) : null}
            </View>
          ) : (
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="12 Riverside Ave, London"
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mb-3"
            />
          )}

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
        </ScrollView>
      </View>
    </BottomSheetModal>
  );
}