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
import {
  useCreateService,
  useServices,
  type Service,
} from "../lib/hooks/useServices";
import { useCurrentBusiness } from "../lib/hooks/useBusiness";
import { useTeamMembers } from "../lib/hooks/useTeam";
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

function toTimeSlot(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

type ServiceFormState = {
  name: string;
  description: string;
  duration_minutes: number;
  price: string;
};

function apiErrorMessage(error: any, fallback: string): string {
  const body = error?.body;
  if (Array.isArray(body)) {
    const text = body.map((v) => String(v)).join("\n");
    if (text) return text;
  } else if (body && typeof body === "object") {
    if (typeof (body as any).detail === "string") return (body as any).detail;
    const messages = Object.entries(body as Record<string, unknown>)
      .flatMap(([field, value]) => {
        const text = Array.isArray(value) ? value.join(" ") : String(value);
        return text ? `${field}: ${text}` : [];
      });
    if (messages.length) return messages.join("\n");
  } else if (typeof body === "string" && body) {
    return body;
  }
  return error?.message || fallback;
}

const EMPTY_CUSTOMER: CustomerFormState = {
  full_name: "",
  email: "",
  phone: "",
  address: "",
};

const EMPTY_SERVICE: ServiceFormState = {
  name: "",
  description: "",
  duration_minutes: 60,
  price: "",
};



export default function CreateBookingModal({ visible, onClose, onCreated }: Props) {
  const { data: custPage } = useCustomers();
  const { data: svcPage } = useServices();
  const create = useCreateJob();
  const createCustomer = useCreateCustomer();
  const createService = useCreateService();
  const checkSlot = useCheckSlot();
  const suggestSlots = useSuggestSlots();
  const business = useCurrentBusiness();
  const isAdmin = business.data?.role === "admin";
  const team = useTeamMembers(isAdmin ? business.data?.id ?? null : null);

  const customers = custPage?.results ?? [];
  const services = (svcPage?.results ?? []).filter((s) => s.is_active);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [slotState, setSlotState] = useState<CheckSlotResponse | null>(null);
  const [suggestions, setSuggestions] = useState<SlotRecommendation[]>([]);
  const [otherAvailable, setOtherAvailable] = useState<string[]>([]);
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
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const [custErr, setCustErr] = useState<string | null>(null);
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [newService, setNewService] = useState<ServiceFormState>(EMPTY_SERVICE);
  const [createdService, setCreatedService] = useState<Service | null>(null);
  const [serviceErr, setServiceErr] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);

  const activeMembers = (team.data ?? []).filter(
    (member) => member.status === "active" && member.user !== null,
  );
  const selectedAssignee = activeMembers.find((member) => member.user === assignedTo);

  const visibleServices = useMemo(() => {
    if (!createdService || services.some((service) => service.id === createdService.id)) {
      return services;
    }
    return [createdService, ...services];
  }, [services, createdService]);

  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setCustomerId(null);
      setServiceId(null);
      setBookingDate("");
      setScheduledAt("");
      setNotes("");
      setPriceOverride("");
      setErr(null);
      setCustSearch("");
      setPickerOpen(false);
      setNewCustOpen(false);
      setNewCust(EMPTY_CUSTOMER);
      setCreatedCustomer(null);
      setNewServiceOpen(false);
      setNewService(EMPTY_SERVICE);
      setCreatedService(null);
      setCustErr(null);
      setServiceSearch("");
      setServicePickerOpen(false);
      setAssignedTo(null);
      setAssigneePickerOpen(false);
      setSlotState(null);
      setSuggestions([]);
      setOtherAvailable([]);
    }
    wasVisible.current = visible;
  }, [visible]);

  const selectedService = useMemo(
    () => visibleServices.find((s) => s.id === serviceId) ??
      (createdService?.id === serviceId ? createdService : undefined),
    [visibleServices, serviceId, createdService],
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ??
      (createdCustomer?.id === customerId ? createdCustomer : null),
    [customers, customerId, createdCustomer],
  );

  const filteredServices = useMemo(() => {
    const q = normalise(serviceSearch);
    if (!q) return visibleServices.slice(0, 50);
    return visibleServices
      .filter(
        (service) =>
          normalise(service.name).includes(q) ||
          normalise(service.description ?? "").includes(q),
      )
      .slice(0, 50);
  }, [visibleServices, serviceSearch]);

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

  const duplicateServiceHit = useMemo(() => {
    const q = normalise(newService.name);
    if (!q) return undefined;
    return services.find((s) => normalise(s.name) === q);
  }, [services, newService.name]);

  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const targetDate = bookingDate || (scheduledAt ? toDateOnly(scheduledAt) : getTomorrowDate());

  const availableTimeSlots = useMemo(() => {
    const slots = [
      ...suggestions.map((recommendation) => recommendation.start),
      ...otherAvailable,
    ]
      .map(toTimeSlot)
      .filter((slot): slot is string => Boolean(slot));
    return Array.from(new Set(slots)).sort();
  }, [suggestions, otherAvailable]);

  useEffect(() => {
    if (!customerId || !selectedService || !targetDate) {
      setSuggestions([]);
      setOtherAvailable([]);
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
        if (!cancelled) {
          setSuggestions(res.recommendations);
          setOtherAvailable(res.other_available);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setOtherAvailable([]);
        }
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
      setCreatedCustomer(created);
      setPickerOpen(false);
      setNewCustOpen(false);
      setNewCust(EMPTY_CUSTOMER);
      setCustSearch("");
    } catch (e: any) {
      setCustErr(apiErrorMessage(e, "Could not create customer."));
    }
  };

  const submitNewService = async () => {
    setServiceErr(null);
    if (!newService.name.trim()) {
      setServiceErr("Name is required.");
      return;
    }
    if (!Number.isInteger(newService.duration_minutes) || newService.duration_minutes <= 0) {
      setServiceErr("Duration must be a whole number greater than zero.");
      return;
    }
    const price = Number(newService.price);
    if (!newService.price.trim() || !Number.isFinite(price) || price < 0) {
      setServiceErr("Enter a valid price of zero or more.");
      return;
    }
    if (duplicateServiceHit) {
      setServiceErr(
        `"${duplicateServiceHit.name}" already exists — select it instead.`,
      );
      return;
    }
    try {
      const created = await createService.mutateAsync({
        name: newService.name.trim(),
        description: newService.description.trim(),
        duration_minutes: newService.duration_minutes,
        price,
      });
      setServiceId(created.id);
      setCreatedService(created);
      setServicePickerOpen(false);
      setNewServiceOpen(false);
      setNewService(EMPTY_SERVICE);
      setServiceErr(null);
    } catch (e: any) {
      setServiceErr(apiErrorMessage(e, "Could not create service."));
    }
  };

  const submit = async () => {
    setErr(null);
    if (!customerId) return setErr("Pick a customer.");
    if (!selectedService) return setErr("Pick a service.");
    if (!scheduledAt) return setErr("Enter a date/time (YYYY-MM-DDTHH:mm).");
    if (isAdmin && !assignedTo) return setErr("Assign a team member.");
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
        assigned_to: assignedTo,
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
        setErr(apiErrorMessage(e, "Could not create booking."));
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
              <Pressable
                onPress={() => {
                  setServicePickerOpen((v) => !v);
                  setNewServiceOpen(false);
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-3 mb-2 flex-row items-center justify-between"
              >
                <View className="flex-1 pr-2">
                  {selectedService ? (
                    <>
                      <Text className="text-sm font-semibold text-slate-900">
                        {selectedService.name}
                      </Text>
                      <Text className="text-[11px] text-slate-500 mt-0.5">
                        {selectedService.duration_minutes} min · ${Number(selectedService.price).toFixed(2)}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-sm text-slate-500">
                      Search or select a service…
                    </Text>
                  )}
                </View>
                <Text className="text-slate-400 text-xs">
                  {servicePickerOpen ? "▲" : "▼"}
                </Text>
              </Pressable>

              {servicePickerOpen ? (
                <View className="border border-slate-200 rounded-xl mb-3 overflow-hidden">
                  <TextInput
                    value={serviceSearch}
                    onChangeText={setServiceSearch}
                    placeholder="Search by service name or description"
                    autoCorrect={false}
                    className="border-b border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />

                  <ScrollView
                    style={{ maxHeight: 240 }}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    {filteredServices.length === 0 ? (
                      <View className="px-3 py-4">
                        <Text className="text-xs text-slate-500">
                          No matches. Create a new service below.
                        </Text>
                      </View>
                    ) : (
                      filteredServices.map((service) => {
                        const active = service.id === serviceId;
                        return (
                          <Pressable
                            key={service.id}
                            onPress={() => {
                              setServiceId(service.id);
                              setServicePickerOpen(false);
                            }}
                            className={`px-3 py-2 border-b border-slate-100 ${
                              active ? "bg-blue-50" : "bg-white"
                            }`}
                          >
                            <View className="flex-row items-center justify-between">
                              <Text
                                className={`flex-1 pr-2 text-sm ${
                                  active
                                    ? "text-blue-700 font-semibold"
                                    : "text-slate-900"
                                }`}
                              >
                                {service.name}
                              </Text>
                              <Text className="text-[11px] text-slate-500">
                                {service.duration_minutes} min · ${Number(service.price).toFixed(2)}
                              </Text>
                            </View>
                            {service.description ? (
                              <Text className="text-[11px] text-slate-500 mt-0.5">
                                {service.description}
                              </Text>
                            ) : null}
                          </Pressable>
                        );
                      })
                    )}
                  </ScrollView>

                  <Pressable
                    onPress={() => setNewServiceOpen(true)}
                    className="px-3 py-3 bg-slate-50 border-t border-slate-200"
                  >
                    <Text className="text-sm font-semibold text-blue-600">
                      + Create new service
                      {serviceSearch.trim() ? ` "${serviceSearch.trim()}"` : ""}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {newServiceOpen ? (
                <View className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 mb-3">
                  <Text className="text-sm font-semibold text-slate-900 mb-2">
                    New service
                  </Text>
                  <TextInput
                    value={newService.name}
                    onChangeText={(v) =>
                      setNewService((s) => ({ ...s, name: v }))
                    }
                    placeholder="Service name *"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 mb-2"
                  />
                  <TextInput
                    value={newService.description}
                    onChangeText={(v) =>
                      setNewService((s) => ({ ...s, description: v }))
                    }
                    placeholder="Description"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 mb-2"
                  />
                  <TextInput
                    value={String(newService.duration_minutes)}
                    onChangeText={(v) =>
                      setNewService((s) => ({ ...s, duration_minutes: Number(v) || 0 }))
                    }
                    placeholder="Duration (minutes)"
                    keyboardType="number-pad"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 mb-2"
                  />
                  <TextInput
                    value={newService.price}
                    onChangeText={(v) => setNewService((s) => ({ ...s, price: v }))}
                    placeholder="Price"
                    keyboardType="numeric"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 mb-2"
                  />

                  {duplicateServiceHit ? (
                    <Text className="text-[11px] text-amber-700 mb-2">
                      Heads up: “{duplicateServiceHit.name}” already exists.{" "}
                      <Text
                        className="text-blue-600 font-semibold"
                        onPress={() => {
                          setServiceId(duplicateServiceHit.id);
                          setNewServiceOpen(false);
                          setServicePickerOpen(false);
                        }}
                      >
                        Use existing
                      </Text>
                    </Text>
                  ) : null}

                  {serviceErr ? (
                    <Text className="text-xs text-red-600 mb-2">{serviceErr}</Text>
                  ) : null}

                  <View className="flex-row gap-2 mt-1">
                    <Pressable
                      onPress={() => {
                        setNewServiceOpen(false);
                        setServiceErr(null);
                      }}
                      className="flex-1 py-2 rounded-full border border-slate-300"
                    >
                      <Text className="text-center text-sm text-slate-700">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={submitNewService}
                      disabled={createService.isPending}
                      style={
                        createService.isPending ? { opacity: 0.5 } : undefined
                      }
                      className="flex-1 py-2 rounded-full bg-blue-600"
                    >
                      {createService.isPending ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="text-center text-sm font-semibold text-white">
                          Save service
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}  
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
                  {suggestions.map((r) => {
                    const isActive = toLocalInput(r.start) === scheduledAt;
                    return (
                      <Pressable
                        key={r.start}
                        onPress={() => {
                          setScheduledAt(toLocalInput(r.start));
                          setBookingDate(toDateOnly(r.start));
                          setSlotState(null);
                        }}
                        className={`rounded-xl px-3 py-2 mr-2 mb-2 border ${
                          isActive
                            ? "bg-slate-900 border-slate-900"
                            : "bg-white border-blue-300"
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            isActive ? "text-white" : "text-blue-800"
                          }`}
                        >
                          {formatTime(r.start)} · {r.label}
                        </Text>
                        <Text
                          className={`text-[10px] mt-0.5 ${
                            isActive ? "text-slate-300" : "text-blue-600"
                          }`}
                        >
                          score {r.score} · {r.total_travel_minutes} min travel
                        </Text>
                      </Pressable>
                    );
                  })}
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
                onDateChange={setBookingDate}
                placeholder="Pick a date and time"
                minimumDate={new Date()}
                timeSlots={availableTimeSlots}
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
                            setBookingDate(toDateOnly(s));
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

            {isAdmin ? (
              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-600 mb-1">
                  Assign to *
                </Text>
                <Pressable
                  onPress={() => setAssigneePickerOpen((open) => !open)}
                  className={`bg-white border rounded-xl px-3 py-3 flex-row items-center justify-between ${
                    !assignedTo ? "border-red-300" : "border-slate-200"
                  }`}
                >
                  <Text className={`text-sm ${selectedAssignee ? "text-slate-900 font-semibold" : "text-slate-500"}`}>
                    {selectedAssignee
                      ? `${selectedAssignee.user_first_name ?? ""} ${selectedAssignee.user_last_name ?? ""}`.trim() || selectedAssignee.user_email
                      : "Select team member"}
                  </Text>
                  <Text className="text-slate-400 text-xs">{assigneePickerOpen ? "▲" : "▼"}</Text>
                </Pressable>
                {assigneePickerOpen ? (
                  <View className="border border-slate-200 rounded-xl mt-2 overflow-hidden">
                    {activeMembers.map((member) => {
                      const name = `${member.user_first_name ?? ""} ${member.user_last_name ?? ""}`.trim() || member.user_email;
                      return (
                        <Pressable
                          key={member.id}
                          onPress={() => {
                            setAssignedTo(member.user);
                            setAssigneePickerOpen(false);
                          }}
                          className={`px-3 py-3 border-t border-slate-100 ${assignedTo === member.user ? "bg-blue-50" : "bg-white"}`}
                        >
                          <Text className="text-sm font-semibold text-slate-900">{name}</Text>
                          <Text className="text-[11px] text-slate-500 capitalize mt-0.5">{member.role}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
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
