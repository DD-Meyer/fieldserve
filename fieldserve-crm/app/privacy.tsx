import { Text, View } from "react-native";

import ScreenScaffold from "../components/ScreenScaffold";

export default function PrivacyScreen() {
  return (
    <ScreenScaffold title="Data privacy" subtitle="How FieldServe protects your information">
      <View className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
        <Text className="text-lg font-semibold text-slate-900 mb-2">Privacy notice</Text>
        <Text className="text-sm leading-6 text-slate-600">
          FieldServe uses your account, business, customer, booking, inspection, and location information to provide scheduling, route tracking, customer management, and reporting features.
        </Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
        <Text className="text-lg font-semibold text-slate-900 mb-2">How we keep data secure</Text>
        <Text className="text-sm leading-6 text-slate-600">
          Access is protected by authenticated sessions and business membership permissions. Data is restricted to the businesses and users authorised to access it, and uploaded inspection media is served through protected application storage.
        </Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 p-5">
        <Text className="text-lg font-semibold text-slate-900 mb-2">Deletion</Text>
        <Text className="text-sm leading-6 text-slate-600">
          When a company account is deleted, its FieldServe data is scheduled for permanent deletion within 90 days. This includes customer records, bookings, services, team memberships, inspections, and associated media. Deletion requests cannot be undone.
        </Text>
      </View>
    </ScreenScaffold>
  );
}