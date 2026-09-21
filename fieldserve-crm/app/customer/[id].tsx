import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import RiskBadge, { type RiskLevel } from "../../components/RiskBadge";
import { useCustomer, useJobs } from "../../lib/hooks/useJobs";
import { useUpdateCustomer } from "../../lib/hooks/useCustomers";
import { useCurrentBusiness } from "../../lib/hooks/useBusiness";
import { useRefresh } from "@/hooks/useRefresh";
import {
  useChurnHistory,
  useChurnScores,
  useMarkCustomerRetained,
  type CustomerRetentionStatus,
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
  const [locationEditorOpen, setLocationEditorOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [retentionStatus, setRetentionStatus] = useState<CustomerRetentionStatus>("reassured");
  const [retentionNote, setRetentionNote] = useState("");
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const updateCustomer = useUpdateCustomer();
  const markRetained = useMarkCustomerRetained();
  const { data: business } = useCurrentBusiness();
  const isMobileBusiness = business?.industry_mode === "mobile";

  const { data: customer, isLoading: custLoading, refetch: refetchCustomer } =
    useCustomer(customerId);
  const { data: jobsPage, refetch: refetchJobs } = useJobs(
    customerId
      ? { customer: customerId, ordering: "-scheduled_at" }
      : {},
  );
  const { data: churnList, refetch: refetchChurn } = useChurnScores();
  const { data: history, refetch: refetchHistory } = useChurnHistory(customerId);

  const { refreshing, onRefresh } = useRefresh([
    refetchCustomer,
    refetchJobs,
    refetchChurn,
    refetchHistory,
  ]);

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

  const openLocationEditor = () => {
    setFullName(customer.full_name);
    setEmail(customer.email);
    setPhone(customer.phone);
    setAddress(customer.address);
    setNotes(customer.notes);
    setLatitude(customer.latitude ?? null);
    setLongitude(customer.longitude ?? null);
    setLocationError(null);
    setLocationEditorOpen(true);
  };

  const saveProfile = async () => {
    if (!fullName.trim()) {
      setLocationError("Customer name is required.");
      return;
    }
    if (
      isMobileBusiness &&
      (!address.trim() || latitude == null || longitude == null)
    ) {
      setLocationError("Select an address from the search results.");
      return;
    }
    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        patch: {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          latitude,
          longitude,
          notes: notes.trim(),
        },
      });
      setLocationEditorOpen(false);
    } catch (error: any) {
      setLocationError(error?.message || "Could not save customer location.");
    }
  };

  const openRetentionEditor = () => {
    setRetentionStatus("reassured");
    setRetentionNote("");
    setRetentionError(null);
    setRetentionOpen(true);
  };

  const saveRetentionSignal = async () => {
    if (!retentionNote.trim()) {
      setRetentionError("Add a short note from the customer conversation.");
      return;
    }
    try {
      await markRetained.mutateAsync({
        customerId: customer.id,
        status: retentionStatus,
        note: retentionNote.trim(),
      });
      setRetentionOpen(false);
    } catch (error: any) {
      setRetentionError(error?.message || "Could not record retention note.");
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title={customer.full_name} back={true} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        
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
          {latestScore?.feature_snapshot?.manual_retention_status ? (
            <View className="mt-3 rounded-xl bg-green-50 border border-green-100 p-3">
              <Text className="text-xs font-bold text-green-800">
                Manual retention adjustment
              </Text>
              <Text className="text-[11px] text-green-700 mt-1 leading-4">
                {latestScore.feature_snapshot.manual_retention_note ||
                  "Customer contact recorded as a retention signal."}
              </Text>
              {latestScore.feature_snapshot.raw_model_probability != null &&
              latestScore.feature_snapshot.manual_adjusted_probability != null ? (
                <Text className="text-[11px] text-green-800 mt-1 font-semibold">
                  Raw {Math.round(latestScore.feature_snapshot.raw_model_probability * 100)}% → adjusted {Math.round(latestScore.feature_snapshot.manual_adjusted_probability * 100)}%
                </Text>
              ) : null}
            </View>
          ) : null}
          {latestScore ? (
            <>
              <Pressable
                onPress={openRetentionEditor}
                className="mt-3 bg-green-700 rounded-full py-2 items-center"
                accessibilityRole="button"
              >
                <Text className="text-white text-xs font-semibold">
                  Record retention call
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/customer-churn/[id]",
                    params: { id: String(customer.id) },
                  })
                }
                className="mt-3 bg-slate-900 rounded-full py-2 items-center"
                accessibilityRole="button"
              >
                <Text className="text-white text-xs font-semibold">
                  View churn analysis
                </Text>
              </Pressable>
            </>
          ) : (
            <View className="mt-3 border border-slate-200 rounded-full py-2 items-center">
              <Text className="text-slate-500 text-xs font-semibold">
                Analysis available after first booking
              </Text>
            </View>
          )}
        </View>

        {/* Contact info */}
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">Contact</Text>
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Phone" value={customer.phone} />
          <InfoRow label="Address" value={customer.address} />
          <Pressable
            onPress={openLocationEditor}
            className="mt-3 border border-blue-600 rounded-full py-2 items-center"
          >
            <Text className="text-blue-600 text-xs font-semibold">
              {customer.latitude != null && customer.longitude != null
                ? "Edit customer"
                : "Add customer location"}
            </Text>
          </Pressable>
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

      <Modal
        visible={locationEditorOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationEditorOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-slate-900">Edit customer</Text>
              <Pressable onPress={() => setLocationEditorOpen(false)}>
                <Text className="text-slate-500">Close</Text>
              </Pressable>
            </View>
            <Text className="text-xs font-semibold text-slate-600 mb-1">Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Customer name"
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 mb-3"
            />
            <Text className="text-xs font-semibold text-slate-600 mb-1">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 mb-3"
            />
            <Text className="text-xs font-semibold text-slate-600 mb-1">Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+44 7700 900000"
              keyboardType="phone-pad"
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 mb-3"
            />
            <Text className="text-xs font-semibold text-slate-600 mb-1">Address</Text>
            <View className="mb-3" style={{ position: "relative", zIndex: 1000, elevation: 1000 }}>
              <GooglePlacesAutocomplete
                placeholder={address || "Search for an address"}
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
                textInputProps={{
                  onChangeText: () => {
                    setLatitude(null);
                    setLongitude(null);
                  },
                }}
                styles={{
                  container: {
                    flex: 0,
                    width: "100%",
                    zIndex: 1000,
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
                    top: 50,
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
            </View>
            {latitude != null && longitude != null ? (
              <Text className="text-[11px] text-green-700 mt-2">Location selected: {address}</Text>
            ) : null}
            <Text className="text-xs font-semibold text-slate-600 mb-1 mt-3">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Customer notes"
              multiline
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900"
              style={{ minHeight: 84, textAlignVertical: "top" }}
            />
            {locationError ? <Text className="text-xs text-red-600 mt-2">{locationError}</Text> : null}
            <Pressable
              onPress={saveProfile}
              disabled={updateCustomer.isPending}
              className="bg-blue-600 rounded-full py-3 items-center mt-4 disabled:opacity-50"
            >
              {updateCustomer.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-sm font-semibold">Save changes</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={retentionOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRetentionOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-slate-900">Record retention call</Text>
              <Pressable onPress={() => setRetentionOpen(false)}>
                <Text className="text-slate-500">Close</Text>
              </Pressable>
            </View>

            <Text className="text-xs font-semibold text-slate-600 mb-2">Outcome</Text>
            <View className="flex-row gap-2 mb-4">
              {([
                ["retained", "Retained"],
                ["reassured", "Reassured"],
                ["watchlist", "Still at risk"],
              ] as const).map(([value, label]) => {
                const active = retentionStatus === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setRetentionStatus(value)}
                    className={`flex-1 rounded-xl border px-2 py-3 items-center ${
                      active ? "border-green-700 bg-green-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <Text className={`text-[11px] font-semibold ${active ? "text-green-800" : "text-slate-600"}`}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-xs font-semibold text-slate-600 mb-1">Conversation note</Text>
            <TextInput
              value={retentionNote}
              onChangeText={setRetentionNote}
              placeholder="e.g. Customer is happy after call and plans to book again next month."
              multiline
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900"
              style={{ minHeight: 96, textAlignVertical: "top" }}
            />
            <Text className="text-[11px] text-slate-500 mt-2 leading-4">
              This records an auditable retention signal and updates the displayed churn risk while preserving the raw model probability.
            </Text>
            {retentionError ? <Text className="text-xs text-red-600 mt-2">{retentionError}</Text> : null}
            <Pressable
              onPress={saveRetentionSignal}
              disabled={markRetained.isPending}
              className="bg-green-700 rounded-full py-3 items-center mt-4 disabled:opacity-50"
            >
              {markRetained.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-sm font-semibold">Save retention note</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
