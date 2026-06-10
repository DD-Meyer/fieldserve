import { Text, View } from "react-native";
import ScreenScaffold from "../components/ScreenScaffold";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";

const INVOICES = [
  { id: "INV-0042", date: "01 Jun 2026", amount: 49.0, status: "Paid" },
  { id: "INV-0041", date: "01 May 2026", amount: 49.0, status: "Paid" },
  { id: "INV-0040", date: "01 Apr 2026", amount: 49.0, status: "Paid" },
];

export default function BillingScreen() {
  return (
    <ScreenScaffold
      title="Billing"
      subtitle="Plan, payment methods and invoices"
    >
      <View className="bg-blue-600 rounded-2xl p-5 mb-5">
        <Text className="text-blue-100 text-xs">Current plan</Text>
        <Text className="text-white text-2xl font-bold mt-1">Pro</Text>
        <Text className="text-blue-100 text-xs mt-1">
          $49 / month · renews 1 Jul 2026
        </Text>
      </View>

      <SettingsGroup title="Plan">
        <SettingsRow label="Change plan" onPress={() => {}} />
        <SettingsRow label="Cancel subscription" destructive onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Payment method">
        <SettingsRow label="Visa ending 4242" value="Default" onPress={() => {}} />
        <SettingsRow label="Add payment method" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Invoices" footer="Receipts are emailed automatically.">
        {INVOICES.map((inv) => (
          <SettingsRow
            key={inv.id}
            label={inv.id}
            description={inv.date}
            value={`$${inv.amount.toFixed(2)} · ${inv.status}`}
            onPress={() => {}}
          />
        ))}
      </SettingsGroup>
    </ScreenScaffold>
  );
}
