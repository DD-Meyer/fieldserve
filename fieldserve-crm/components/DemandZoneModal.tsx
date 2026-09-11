import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import type { Service } from "../lib/hooks/useServices";
import type { DemandZone } from "../lib/hooks/usePredictions";

type Props = {
  zone: DemandZone | null;
  services: Service[];
  onClose: () => void;
};

export default function DemandZoneModal({ zone, services, onClose }: Props) {
  if (!zone) return null;
  const activeNames = new Set(
    services.filter((service) => service.is_active).map((service) => service.name.toLowerCase())
  );
  const missing = zone.service_mix.filter((service) => !activeNames.has(service.name.toLowerCase()));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-5" style={{ maxHeight: "88%" }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-slate-900">{zone.name}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close demand zone details">
              <Text className="text-slate-500">Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Text className="text-xs text-slate-500 mb-4">Why this area matters</Text>
            <View className="flex-row mb-4">
              <View className="flex-1 mr-2 bg-slate-50 rounded-xl p-3">
                <Text className="text-[11px] text-slate-500">Bookings</Text>
                <Text className="text-lg font-bold text-slate-900 mt-1">{zone.booking_count}</Text>
              </View>
              <View className="flex-1 mx-1 bg-slate-50 rounded-xl p-3">
                <Text className="text-[11px] text-slate-500">Customers</Text>
                <Text className="text-lg font-bold text-slate-900 mt-1">{zone.customer_count}</Text>
              </View>
              <View className="flex-1 ml-2 bg-slate-50 rounded-xl p-3">
                <Text className="text-[11px] text-slate-500">Share</Text>
                <Text className="text-lg font-bold text-slate-900 mt-1">{zone.share_pct}%</Text>
              </View>
            </View>

            <Text className="text-sm font-semibold text-slate-900">Customer signal</Text>
            <Text className="text-xs leading-4 text-slate-500 mt-1 mb-4">{zone.customer_signal}</Text>

            <Text className="text-sm font-semibold text-slate-900">Popular services in this area</Text>
            {zone.service_mix.length ? zone.service_mix.map((service) => (
              <View key={service.name} className="flex-row justify-between border-b border-slate-100 py-2">
                <Text className="text-xs text-slate-700">{service.name}</Text>
                <Text className="text-xs font-semibold text-slate-900">{service.bookings} bookings</Text>
              </View>
            )) : <Text className="text-xs text-slate-500 mt-2">Not enough service history for this area.</Text>}

            <Text className="text-sm font-semibold text-slate-900 mt-5">Service opportunity</Text>
            {missing.length ? (
              <Text className="text-xs leading-4 text-blue-800 bg-blue-50 rounded-xl p-3 mt-2">
                Consider adding {missing.map((service) => service.name).join(", ")}. These services appear in local demand but are not currently active in your catalogue.
              </Text>
            ) : (
              <Text className="text-xs leading-4 text-green-800 bg-green-50 rounded-xl p-3 mt-2">
                Your active catalogue already covers the popular recorded services in this area.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}