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
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import CustomerChurnCard, {
  type ChurnCustomer,
} from "../../components/CustomerChurnCard";
import FilterPills from "../../components/FilterPills";
import { levelFromProb } from "../../components/RiskBadge";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
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

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 999;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// Placeholder churn calc until the ML service wires up.
function toChurn(c: Customer): ChurnCustomer {
  const recency = daysSince(c.last_seen_at);
  const probability = Math.min(0.95, recency / 120);
  return {
    id: c.id,
    name: c.full_name,
    lastVisit: c.last_seen_at ? `${recency} days ago` : "Never",
    probability,
    recencyDays: recency,
    frequency: 0,
    monetary: 0,
  };
}

export default function Customers() {
  const [active, setActive] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const tabBarSpace = useTabBarSpace();

  const { data, isLoading, error, refetch } = useCustomers();
  const customers = (data?.results ?? []).map(toChurn);

  const filtered = useMemo(() => {
    if (active === "all") return customers;
    return customers.filter((c) => levelFromProb(c.probability) === active);
  }, [active, customers]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    customers.forEach((cust) => {
      c[levelFromProb(cust.probability)]++;
    });
    return c;
  }, [customers]);

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
          Placeholder scores — real RFM model coming once ML service is wired.
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

        {isLoading ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-6 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
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
          filtered.map((c) => <CustomerChurnCard key={c.id} customer={c} />)
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