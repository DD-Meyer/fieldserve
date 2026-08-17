import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import "../../global.css";

import DateTimePickerField from "../../components/DateTimePickerField";

const SafeAreaView = styled(RNSafeAreaView);

const RAW_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE = RAW_BASE.replace(/\/$/, "");

type PublicBusiness = {
  name: string;
  trading_name: string;
  slug: string;
  industry_mode: string;
  brand_color: string;
  logo_url: string;
  address_city: string;
  address_country: string;
  public_booking_enabled: boolean;
};

type PublicService = {
  id: number;
  slug: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: string;
};

type SlotRecommendation = {
  start: string;
  end: string;
  score: number;
  label: string;
  total_travel_minutes: number;
};

type SuggestSlotsResponse = {
  date: string;
  recommendations: SlotRecommendation[];
  other_available: string[];
};

type CustomerLookup = {
  found: boolean;
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      (parsed && (parsed.detail || JSON.stringify(parsed))) || `${res.status}`;
    throw new Error(msg);
  }
  return parsed as T;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ data: null, error: null, loading: true });

  useMemo(() => {
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    fn()
      .then((d) => {
        if (!cancelled) setState({ data: d, error: null, loading: false });
      })
      .catch((e) => {
        if (!cancelled)
          setState({ data: null, error: String(e?.message ?? e), loading: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-slate-600 mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900"
        style={multiline ? { minHeight: 80, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}

export default function PublicBookingPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const bizState = useAsync<PublicBusiness>(
    () => apiGet<PublicBusiness>(`/api/public/businesses/${slug}/`),
    [slug],
  );
  const svcState = useAsync<PublicService[]>(
    () => apiGet<PublicService[]>(`/api/public/businesses/${slug}/services/`),
    [slug],
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState(""); // ISO local: YYYY-MM-DDTHH:mm
  const [suggestions, setSuggestions] = useState<SlotRecommendation[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [knownCustomer, setKnownCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<{
    booking_id: number;
    service: string;
    scheduled_at: string;
  } | null>(null);

  const brand = bizState.data?.brand_color || "#2563EB";

  const targetDate = useMemo(() => {
    if (scheduledAt) return scheduledAt.slice(0, 10);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, [scheduledAt]);

  const minPickDate = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!serviceId || !slug) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    apiPost<SuggestSlotsResponse>(
      `/api/public/businesses/${slug}/suggest-slots/`,
      {
        date: targetDate,
        service_id: serviceId,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      },
    )
      .then((res) => {
        if (!cancelled) setSuggestions(res.recommendations);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, serviceId, targetDate, email, phone]);

  useEffect(() => {
    if (!slug) return;
    const emailTrim = email.trim();
    const phoneTrim = phone.trim();
    if (!emailTrim && !phoneTrim) {
      setKnownCustomer(false);
      return;
    }
    // Wait until email at least looks well-formed to avoid noisy lookups.
    if (emailTrim && !emailTrim.includes("@")) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      apiPost<CustomerLookup>(`/api/public/businesses/${slug}/lookup-customer/`, {
        email: emailTrim || undefined,
        phone: phoneTrim || undefined,
      })
        .then((res) => {
          if (cancelled || !res.found) {
            if (!cancelled) setKnownCustomer(false);
            return;
          }
          setKnownCustomer(true);
          if (!fullName.trim() && res.full_name) setFullName(res.full_name);
          if (!phone.trim() && res.phone) setPhone(res.phone);
          if (!address.trim() && res.address) setAddress(res.address);
        })
        .catch(() => {
          if (!cancelled) setKnownCustomer(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, email, phone]);

  const submit = async () => {
    if (!serviceId) {
      Alert.alert("Pick a service", "Please choose a service to book.");
      return;
    }
    if (!scheduledAt) {
      Alert.alert(
        "Pick a time",
        "Enter a date/time like 2026-08-01T10:00 (24-hour).",
      );
      return;
    }
    setSubmitting(true);
    try {
      const iso = new Date(scheduledAt).toISOString();
      const res = await apiPost<{
        booking_id: number;
        service: string;
        scheduled_at: string;
      }>(`/api/public/businesses/${slug}/bookings/`, {
        full_name: fullName,
        email,
        phone,
        address,
        notes,
        service_id: serviceId,
        scheduled_at: iso,
      });
      setConfirm(res);
    } catch (e: any) {
      Alert.alert("Booking failed", String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  if (bizState.loading || svcState.loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (bizState.error || !bizState.data) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-slate-900 text-lg font-bold mb-2">
            Business not found
          </Text>
          <Text className="text-slate-500 text-sm text-center">
            {bizState.error || "This booking link isn't valid."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bizState.data.public_booking_enabled) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-slate-900 text-lg font-bold">
            Bookings paused
          </Text>
          <Text className="text-slate-500 text-sm text-center mt-2">
            {bizState.data.name}{" isn't accepting online bookings right now."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (confirm) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View
            className="rounded-2xl p-5 mb-5"
            style={{ backgroundColor: brand }}
          >
            <Text className="text-white text-xl font-bold">
              Thanks, {fullName || "there"}!
            </Text>
            <Text className="text-white/90 text-sm mt-1">
              {"We've received your booking request."}
            </Text>
          </View>
          <View className="bg-white rounded-2xl border border-slate-200 p-4">
            <Text className="text-xs text-slate-500">Reference</Text>
            <Text className="text-lg font-bold text-slate-900 mb-3">
              #{confirm.booking_id}
            </Text>
            <Text className="text-xs text-slate-500">Service</Text>
            <Text className="text-sm text-slate-900 mb-3">{confirm.service}</Text>
            <Text className="text-xs text-slate-500">When</Text>
            <Text className="text-sm text-slate-900">
              {new Date(confirm.scheduled_at).toLocaleString()}
            </Text>
          </View>
          <Text className="text-xs text-slate-500 text-center mt-6">
            {bizState.data.name} will confirm shortly.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const services = svcState.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        <View
          className="rounded-2xl p-5 mb-5"
          style={{ backgroundColor: brand }}
        >
          <Text className="text-white text-xs uppercase tracking-wide opacity-80">
            Book with
          </Text>
          <Text className="text-white text-2xl font-bold mt-1">
            {bizState.data.name}
          </Text>
          {bizState.data.address_city ? (
            <Text className="text-white/90 text-xs mt-1">
              {bizState.data.address_city}
              {bizState.data.address_country
                ? `, ${bizState.data.address_country}`
                : ""}
            </Text>
          ) : null}
        </View>

        <Text className="text-sm font-bold text-slate-900 mb-2">
          1. Choose a service
        </Text>
        {services.length === 0 ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
            <Text className="text-xs text-slate-500">
              No services listed yet. Please check back soon.
            </Text>
          </View>
        ) : (
          <View className="mb-5">
            {services.map((s) => {
              const selected = serviceId === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setServiceId(s.id)}
                  className={`bg-white rounded-2xl border p-4 mb-2 ${
                    selected ? "border-blue-600" : "border-slate-200"
                  }`}
                  style={
                    selected
                      ? { borderColor: brand, borderWidth: 2 }
                      : undefined
                  }
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-semibold text-slate-900">
                        {s.name}
                      </Text>
                      {s.description ? (
                        <Text className="text-xs text-slate-500 mt-1">
                          {s.description}
                        </Text>
                      ) : null}
                      <Text className="text-[11px] text-slate-500 mt-1">
                        {s.duration_minutes} min
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-slate-900">
                      ${Number(s.price).toFixed(2)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text className="text-sm font-bold text-slate-900 mb-2">
          2. Your details
        </Text>
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
          {knownCustomer ? (
            <View className="mb-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <Text className="text-[11px] font-semibold text-green-800">
                {"Welcome back — we've prefilled your details."}
              </Text>
            </View>
          ) : null}
          <Field
            label="Full name"
            value={fullName}
            onChange={setFullName}
            placeholder="Jane Smith"
          />
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="jane@example.com"
            keyboardType="email-address"
          />
          <Field
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="+44 …"
            keyboardType="phone-pad"
          />
          <Field
            label="Address"
            value={address}
            onChange={setAddress}
            placeholder="Where the service happens"
          />
        </View>

        <Text className="text-sm font-bold text-slate-900 mb-2">
          3. When?
        </Text>
        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
          {suggestions.length > 0 ? (
            <View className="mb-3">
              <Text className="text-[11px] font-semibold text-slate-700 mb-2">
                Recommended times
              </Text>
              <View className="flex-row flex-wrap">
                {suggestions.map((r) => {
                  const localStart = isoToLocalInput(r.start);
                  const active = scheduledAt === localStart;
                  return (
                    <Pressable
                      key={r.start}
                      onPress={() => setScheduledAt(localStart)}
                      className={`rounded-xl px-3 py-2 mr-2 mb-2 border ${
                        active ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                      }`}
                      style={active ? { borderColor: brand } : undefined}
                    >
                      <Text className="text-xs font-semibold text-slate-900">
                        {new Date(r.start).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" \u00b7 "}
                        {r.label}
                      </Text>
                      <Text className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(r.start).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : loadingSlots && serviceId ? (
            <View className="flex-row items-center mb-3">
              <ActivityIndicator size="small" />
              <Text className="text-[11px] text-slate-500 ml-2">
                Finding open slots…
              </Text>
            </View>
          ) : null}

          <Text className="text-xs font-semibold text-slate-600 mb-1">
            Preferred date & time
          </Text>
          <View className="mb-3">
            <DateTimePickerField
              value={scheduledAt}
              onChange={setScheduledAt}
              placeholder="Pick a date and time"
              minimumDate={minPickDate}
            />
          </View>
          <Field
            label="Notes (optional)"
            value={notes}
            onChange={setNotes}
            placeholder="Anything we should know?"
            multiline
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={submitting || !fullName || services.length === 0}
          className="rounded-full py-3 items-center"
          style={{
            backgroundColor: brand,
            opacity: submitting || !fullName || services.length === 0 ? 0.5 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-sm font-bold">Request booking</Text>
          )}
        </Pressable>

        <Text className="text-[11px] text-slate-400 text-center mt-3">
          Powered by FieldServe
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
