import { Text, View } from "react-native";
import ScreenScaffold from "../components/ScreenScaffold";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";

export default function SupportScreen() {
  return (
    <ScreenScaffold title="Support" subtitle="Help, docs and contact">
      <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5">
        <Text className="text-sm font-semibold text-blue-900">Need a hand?</Text>
        <Text className="text-xs text-blue-800 mt-1 leading-4">
          Most answers are in the help center. Otherwise we usually reply within
          a few hours on weekdays.
        </Text>
      </View>

      <SettingsGroup title="Help">
        <SettingsRow label="Help center" onPress={() => {}} />
        <SettingsRow label="Getting started guide" onPress={() => {}} />
        <SettingsRow label="Video tutorials" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Contact us">
        <SettingsRow
          label="Email support"
          value="support@fieldserve.local"
          onPress={() => {}}
        />
        <SettingsRow label="Live chat" description="Mon–Fri, 9am–6pm GMT" onPress={() => {}} />
        <SettingsRow label="Report a bug" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Legal">
        <SettingsRow label="Terms of service" onPress={() => {}} />
        <SettingsRow label="Privacy policy" onPress={() => {}} />
        <SettingsRow label="App version" value="0.1.0" chevron={false} />
      </SettingsGroup>
    </ScreenScaffold>
  );
}
