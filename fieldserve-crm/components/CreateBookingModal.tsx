import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  useCreateJob,
  useCheckSlot,
  useSuggestSlots,
  type CheckSlotResponse,
  type SlotRecommendation,
} from "../lib/hooks/useJobs";
import {
  useCreateCustomer,
  useCustomers,
  type Customer,
} from "../lib/hooks/useCustomers";
import { useServices } from "../lib/hooks/useServices";
import { useCurrentBusiness } from "../lib/hooks/useBusiness";
import DateTimePickerField from "./DateTimePickerField";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

function isoOrThrow(local: string): string {
  const d = new Date(local);
  if (isNaN(d.getTime())) throw new Error("Invalid date/time");
  return d.toISOString();
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSlotChip(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function toDateOnly(local: string): string {
  const d = new Date(local);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalise(s: string): string {
  return s.trim().toLowerCase();
}

type CustomerFormState = {
  full_name: string;
  email: string;
  phone: string;
  address: string;
};

const EMPTY_CUSTOMER: CustomerFormState = {
  full_name: "",
  email: "",
  phone: "",
  address: "",
};

export default function CreateBookingModal({ visible, onClose, onCreated }: Props) {
  const { data: custPage } = useCustomers();
  const { data: svcPage } = useServices();
  const create = useCreateJob();
  const createCustomer = useCreateCustomer();
  const checkSlot = useCheckSlot();
  const suggestSlots = useSuggestSlots();
  const business = useCurrentBusiness();

  const customers = custPage?.results ?? [];
  const services = (svcPage?.results ?? []).filter((s) => s.is_active);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [slotState, setSlotState] = useState<CheckSlotResponse | null>(null);
  const [suggestions, setSuggestions] = useState<SlotRecommendation[]>([]);
  const suggestDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const [custSearch, setCustSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [newCust, setNewCust] = useState<CustomerFormState>(EMPTY_CUSTOMER);
  const [custErr, setCustErr] = useState<string | null>(null);

  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setCustomerId(null);
      setServiceId(null);
      setScheduledAt("");
      setNotes("");
      setPriceOverride("");
      setErr(null);
      setCustSearch("");
      setPickerOpen(false);
      setNewCustOpen(false);
      setNewCust(EMPTY_CUSTOMER);
      setCustErr(null);
      setSlotState(null);
      setSuggestions([]);
    }
    wasVisible.current = visible;
  }, [visible]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const filteredCustomers = useMemo(() => {
    const q = normalise(custSearch);
    if (!q) return customers.slice(0, 50);
    return customers
      .filter(
        (c) =>
          normalise(c.full_name).includes(q) ||
          normalise(c.email ?? "").includes(q) ||
          normalise(c.phone ?? "").includes(q) ||
          normalise(c.address ?? "").includes(q),
      )
      .slice(0, 50);
  }, [customers, custSearch]);

  const duplicateHit = useMemo<Customer | undefined>(() => {
    const q = normalise(newCust.full_name);
    if (!q) return undefined;
    return customers.find((c) => normalise(c.full_name) === q);
  }, [customers, newCust.full_name]);

  const targetDate = scheduledAt ? toDateOnly(scheduledAt) : suggestDate;

  useEffect(() => {
    if (!customerId || !selectedService || !targetDate) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    suggestSlots
      .mutateAsync({
        date: targetDate,
        customer: customerId,
        duration_minutes: selectedService.duration_minutes,
      })
      .then((res) => {
        if (!cancelled) setSuggestions(res.recommendations);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, serviceId, targetDate]);

  useEffect(() => {
    if (!customerId || !selectedService || !scheduledAt) {
      setSlotState(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      try {
        const iso = isoOrThrow(scheduledAt);
        checkSlot
          .mutateAsync({
            customer: customerId,
            scheduled_at: iso,
            duration_minutes: selectedService.duration_minutes,
          })
          .then((res) => {
            if (!cancelled) setSlotState(res);
          })
          .catch(() => {
            if (!cancelled) setSlotState(null);
          });
      } catch {
        if (!cancelled) setSlotState(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, serviceId, scheduledAt]);

  const submitNewCustomer = async () => {
    setCustErr(null);
    if (!newCust.full_name.trim()) {
      setCustErr("Name is required.");
      return;
    }
    if (duplicateHit) {
      setCustErr(
        `"${duplicateHit.full_name}" already exists — select them instead.`,
      );
      return;
    }
    try {
      const created = await createCustomer.mutateAsync({
        full_name: newCust.full_name.trim(),
        email: newCust.email.trim(),
        phone: newCust.phone.trim(),
        address: newCust.address.trim(),
      });
      setCustomerId(created.id);
      setPickerOpen(false);
      setNewCustOpen(false);
      setNewCust(EMPTY_CUSTOMER);
      setCustSearch("");
    } catch (e: any) {
      setCustErr(e?.message || "Could not create customer.");
    }
  };

  const submit = async () => {
    setErr(null);
    if (!customerId) return setErr("Pick a customer.");
    if (!selectedService) return setErr("Pick a service.");
    if (!scheduledAt) return setErr("Enter a date/time (YYYY-MM-DDTHH:mm).");
    if (slotState && !slotState.ok) {
      return setErr(
        slotState.reason === "outside_hours"
          ? `Outside company hours (${business.data?.working_hours_start?.slice(0, 5)}–${business.data?.working_hours_end?.slice(0, 5)}).`
          : "Time conflicts with another job — pick a suggested slot.",
      );
    }
    try {
      const iso = isoOrThrow(scheduledAt);
      await create.mutateAsync({
        customer: customerId,
        service_type: selectedService.name,
        scheduled_at: iso,
        duration_minutes: selectedService.duration_minutes,
        price: priceOverride
          ? Number(priceOverride)
          : (Number(selectedService.price) as unknown as string),
        notes,
      });
      onCreated?.();
      onClose();
    } catch (e: any) {
      const body = e?.body as
        | { scheduled_at?: string; suggested_slots?: string[] }
        | undefined;
      if (body?.scheduled_at && body?.suggested_slots) {
        setSlotState({
          ok: false,
          reason: body.scheduled_at as CheckSlotResponse["reason"],
          suggested_slots: body.suggested_slots,
        });
        setErr("Slot unavailable — try a suggestion below.");
      } else {
        setErr(e?.message || "Could not create booking.");
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-5" style={{ maxHeight: "90%" }}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-slate-900">New booking</Text>
            <Pressable onPress={onClose}>
              <Text className="text-slate-500 text-base">Close</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="text-xs font-semibold text-slate-600 mb-1">
              Customer
            </Text>

            <Pressable
              onPress={() => {
                setPickerOpen((v) => !v);
                setNewCustOpen(false);
              }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-3 mb-2 flex-row items-center justify-between"
            >
              <View className="flex-1 pr-2">
                {selectedCustomer ? (
                  <>
                    <Text className="text-sm font-semibold text-slate-900">
                      {selectedCustomer.full_name}
                    </Text>
                    {selectedCustomer.email || selectedCustomer.phone ? (
                      <Text className="text-[11px] text-slate-500 mt-0.5">
                        {[selectedCustomer.email, selectedCustomer.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text className="text-sm text-slate-500">
                    Search or select a customer…
                  </Text>
                )}
              </View>
              <Text className="text-slate-400 text-xs">
                {pickerOpen ? "▲" : "▼"}
              </Text>
            </Pressable>

            {pickerOpen ? (
              <View className="border border-slate-200 rounded-xl mb-3 overflow-hidden">
                <TextInput
                  value={custSearch}
                  onChangeText={setCustSearch}
                  placeholder="Search by name, email, phone, address"
                  autoCorrect={false}
                  autoCapitalize="none"
                  className="border-b border-slate-200 px-3 py-2 text-sm text-slate-900"
                />

                <ScrollView
                  style={{ maxHeight: 240 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {filteredCustomers.length === 0 ? (
                    <View className="px-3 py-4">
                      <Text className="text-xs text-slate-500">
                        No matches. Create a new customer below.
                      </Text>
                    </View>
                  ) : (
                    filteredCustomers.map((c) => {
                      const active = c.id === customerId;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            setCustomerId(c.id);
                            setPickerOpen(false);
                          }}
                          className={`px-3 py-2 border-b border-slate-100 ${
                            active ? "bg-blue-50" : "bg-white"
                          }`}
                        >
                          <Text
                            className={`text-sm ${
                              active
                                ? "text-blue-700 font-semibold"
                                : "text-slate-900"
                            }`}
                          >
                            {c.full_name}
                          </Text>
                          {c.email || c.phone ? (
                            <Text className="text-[11px] text-slate-500 mt-0.5">
                              {[c.email, c.phone].filter(Boolean).join(" · ")}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>

                <Pressable
                  onPress={() => {
                    setNewCust((v) => ({
                      ...v,
                      full_name: v.full_name || custSearch.trim(),
                    }));
                    setNewCustOpen(true);
                  }}
                  className="px-3 py-3 bg-slate-50 border-t border-slate-200"
                >
                  <Text className="text-sm font-semibold text-blue-600">
                    + Create new customer
                    {custSearch.trim() ? ` "${custSearch.trim()}"` : ""}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {newCustOpen ? (
              <View className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 mb-3">
                <Text className="text-sm font-semibold text-slate-900 mb-2">
                  New customer
                </Text>
                <TextInput
                  value={newCust.full_name}
                  onChangeText={(v) =>
                    setNewCust((s) => ({ ...s, full_name: v }))
                  }
                  placeholder="Full name *"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 mb-2"
                />
                <TextInput
                  value={newCust.email}
                  onChangeText={(v) => setNewCust((s) => ({ ...s, email: v }))}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 mb-2"
                />
                <TextInput
                  value={newCust.phone}
                  onChangeText={(v) => setNewCust((s) => ({ ...s, phone: v }))}
                  placeholder="Phone"
                  keyboardType="phone-pad"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 mb-2"
                />
                <TextInput
                  value={newCust.address}
                  onChangeText={(v) =>
                    setNewCust((s) => ({ ...s, address: v }))
                  }
                  placeholder="Address"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 mb-2"
                />

                {duplicateHit ? (
                  <Text className="text-[11px] text-amber-700 mb-2">
                    Heads up: “{duplicateHit.full_name}” already exists.{" "}
                    <Text
                      className="text-blue-600 font-semibold"
                      onPress={() => {
                        setCustomerId(duplicateHit.id);
                        setNewCustOpen(false);
                        setPickerOpen(false);
                      }}
                    >
                      Use existing
                    </Text>
                  </Text>
                ) : null}

                {custErr ? (
                  <Text className="text-xs text-red-600 mb-2">{custErr}</Text>
                ) : null}

                <View className="flex-row gap-2 mt-1">
                  <Pressable
                    onPress={() => {
                      setNewCustOpen(false);
                      setCustErr(null);
                    }}
                    className="flex-1 py-2 rounded-full border border-slate-300"
                  >
                    <Text className="text-center text-sm text-slate-700">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={submitNewCustomer}
                    disabled={createCustomer.isPending}
                    style={
                      createCustomer.isPending ? { opacity: 0.5 } : undefined
                    }
                    className="flex-1 py-2 rounded-full bg-blue-600"
                  >
                    {createCustomer.isPending ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-center text-sm font-semibold text-white">
                        Save customer
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text className="text-xs font-semibold text-slate-600 mb-1">
              Service
            </Text>
            <View className="mb-3">
              {services.length === 0 ? (
                <Text className="text-xs text-slate-500">
                  No active services — create one on the Services screen.
                </Text>
              ) : (
                services.map((s) => {
                  const active = s.id === serviceId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setServiceId(s.id)}
                      className={`p-3 rounded-xl border mb-2 ${
                        active
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-sm font-semibold text-slate-900">
                            {s.name}
                          </Text>
                          <Text className="text-[11px] text-slate-500 mt-0.5">
                            {s.duration_minutes} min
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-slate-900">
                          ${Number(s.price).toFixed(2)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            <Text className="text-xs font-semibold text-slate-600 mb-1">
              Date & time
            </Text>

            {suggestions.length > 0 ? (
              <View className="mb-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
                <Text className="text-[11px] font-semibold text-blue-900 mb-2">
                  Recommended for {targetDate}
                </Text>
                <View className="flex-row flex-wrap">
                  {suggestions.map((r) => (
                    <Pressable
                      key={r.start}
                      onPress={() => {
                        setScheduledAt(toLocalInput(r.start));
                        setSlotState(null);
                      }}
                      className="bg-white border border-blue-300 rounded-xl px-3 py-2 mr-2 mb-2"
                    >
                      <Text className="text-xs font-semibold text-blue-800">
                        {formatTime(r.start)} · {r.label}
                      </Text>
                      <Text className="text-[10px] text-blue-600 mt-0.5">
                        score {r.score} · {r.total_travel_minutes} min travel
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : customerId && selectedService && suggestSlots.isPending ? (
              <View className="mb-2 flex-row items-center">
                <ActivityIndicator size="small" />
                <Text className="text-[11px] text-slate-500 ml-2">
                  Finding open slots…
                </Text>
              </View>
            ) : null}

            <View className="mb-2">
              <DateTimePickerField
                value={scheduledAt}
                onChange={setScheduledAt}
                placeholder="Pick a date and time"
                minimumDate={new Date()}
              />
            </View>

            {slotState && !slotState.ok ? (
              <View className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3">
                <Text className="text-xs font-semibold text-red-800">
                  {slotState.reason === "outside_hours"
                    ? `Outside company hours (${business.data?.working_hours_start?.slice(0, 5) ?? "08:00"}\u2013${business.data?.working_hours_end?.slice(0, 5) ?? "18:00"}).`
                    : "Time conflicts with another job on that day."}
                </Text>
                {slotState.suggested_slots.length > 0 ? (
                  <>
                    <Text className="text-[11px] text-slate-600 mt-2">
                      Next available:
                    </Text>
                    <View className="flex-row flex-wrap mt-1">
                      {slotState.suggested_slots.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => {
                            setScheduledAt(toLocalInput(s));
                            setSlotState(null);
                          }}
                          className="bg-white border border-red-300 rounded-full px-3 py-1 mr-2 mb-2"
                        >
                          <Text className="text-xs text-red-700 font-medium">
                            {formatSlotChip(s)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : slotState?.ok ? (
              <View className="mb-3">
                <Text className="text-[11px] text-green-700">Slot available.</Text>
              </View>
            ) : null}

            <Text className="text-xs font-semibold text-slate-600 mb-1">
              Notes
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional"
              multiline
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 mb-3"
              style={{ minHeight: 60, textAlignVertical: "top" }}
            />

            <Text className="text-xs font-semibold text-slate-600 mb-1">
              Price override ($) — optional
            </Text>
            <TextInput
              value={priceOverride}
              onChangeText={setPriceOverride}
              placeholder={
                selectedService
                  ? `Default: ${Number(selectedService.price).toFixed(2)}`
                  : ""
              }
              keyboardType="decimal-pad"
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 mb-3"
            />

            {err ? (
              <Text className="text-xs text-red-600 mb-2">{err}</Text>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={create.isPending}
              className="bg-blue-600 rounded-full py-3 items-center mt-2 mb-6"
              style={create.isPending ? { opacity: 0.5 } : undefined}
            >
              {create.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-sm font-semibold">
                  Create booking
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
