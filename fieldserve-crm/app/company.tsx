import { Text, View } from "react-native";

import ScreenScaffold from "../components/ScreenScaffold";
import SegmentedToggle from "../components/SegmentedToggle";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";
import { useIndustry } from "../contexts/IndustryContext";

const INDUSTRY_OPTIONS = [
  { key: "mobile", label: "Mobile Service" },
  { key: "fixed", label: "Fixed Location" },
];

export default function CompanyScreen() {
  const { mode, setMode } = useIndustry();

  return (
    <ScreenScaffold title="Company Info" subtitle="Business profile and branding">
      <Text className="text-[11px] uppercase tracking-wider text-slate-500 px-1 mb-2">
        Industry type
      </Text>
      <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-2">
        <SegmentedToggle
          options={INDUSTRY_OPTIONS}
          active={mode}
          onChange={(k) => setMode(k as "mobile" | "fixed")}
        />
        <Text className="text-xs text-slate-500 mt-3 leading-4">
          {mode === "mobile"
            ? "You travel to customers (detailing, plumbing, mobile repair). Schedule shows route optimisation; Map shows demand heat map."
            : "Customers come to you (salon, clinic, studio). Schedule shows appointment slots; Map shows customer catchment."}
        </Text>
      </View>
      <Text className="text-[11px] text-slate-500 px-1 mt-1 mb-5 leading-4">
        Changes which scheduling and demand views the app uses across all tabs.
      </Text>

      <SettingsGroup title="Business">
        <SettingsRow label="Name" value="FieldServe Detailing" onPress={() => {}} />
        <SettingsRow label="Trading name" value="FieldServe" onPress={() => {}} />
        <SettingsRow label="Tax ID" value="—" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Contact">
        <SettingsRow label="Email" value="hello@fieldserve.local" onPress={() => {}} />
        <SettingsRow label="Phone" value="+44 20 1234 5678" onPress={() => {}} />
        <SettingsRow label="Website" value="fieldserve.local" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Address">
        <SettingsRow
          label={mode === "mobile" ? "Service area" : "Premises address"}
          value={mode === "mobile" ? "Greater London" : "12 High Street, EC1A 1BB"}
          onPress={() => {}}
        />
        <SettingsRow label="Registered address" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Branding">
        <SettingsRow label="Logo" value="Default" onPress={() => {}} />
        <SettingsRow label="Brand colour" value="#2563EB" onPress={() => {}} />
      </SettingsGroup>
    </ScreenScaffold>
  );
}
