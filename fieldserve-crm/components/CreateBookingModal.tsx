import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useCreateJob } from "../lib/hooks/useJobs";
import { useCustomers } from "../lib/hooks/useCustomers";
import { useServices } from "../lib/hooks/useServices";

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

export default function CreateBookingModal({ visible, onClose, onCreated }: Props) {
  const { data: custPage } = useCustomers();
  const { data: svcPage } = useServices();
  const create = useCreateJob();

  const customers = custPage?.results ?? [];
  const services = (svcPage?.results ?? []).filter((s) => s.is_active);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setCustomerId(null);
      setServiceId(null);
      setScheduledAt("");
      setNotes("");
      setPriceOverride("");
      setErr(null);
    }
    wasVisible.current = visible;
  }, [visible]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  const submit = async () => {
    setErr(null);
    if (!customerId) return setErr("Pick a customer.");
    if (!selectedService) return setErr("Pick a service.");
    if (!scheduledAt) return setErr("Enter a date/time (YYYY-MM-DDTHH:mm).");
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
      setErr(e?.message || "Could not create booking.");
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

          <ScrollView>
            <Text className="text-xs font-semibold text-slate-600 mb-1">
              Customer
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-3"
            >
              {customers.length === 0 ? (
                <Text className="text-xs text-slate-500">
                  No customers yet — add one from the Customers tab.
                </Text>
              ) : (
                customers.map((c) => {
                  const active = c.id === customerId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCustomerId(c.id)}
                      className={`px-3 py-2 rounded-full mr-2 border ${
                        active
                          ? "bg-blue-600 border-blue-600"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? "text-white" : "text-slate-700"
                        }`}
                      >
                        {c.full_name}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

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
            <TextInput
              value={scheduledAt}
              onChangeText={setScheduledAt}
              placeholder="2026-08-15T14:30"
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 mb-3"
            />

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
