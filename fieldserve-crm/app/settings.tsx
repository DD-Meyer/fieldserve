import { Switch } from "react-native";
import { useState } from "react";

import ScreenScaffold from "../components/ScreenScaffold";
import SegmentedToggle from "../components/SegmentedToggle";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";
import { useIndustry } from "../contexts/IndustryContext";
import { useCurrentBusiness, useUpdateBusiness } from "../lib/hooks/useBusiness";

const INDUSTRY_OPTIONS = [
  { key: "mobile", label: "Mobile Service" },
  { key: "fixed", label: "Fixed Location" },
];

export default function SettingsScreen() {
  const { mode, setMode } = useIndustry();
  const business = useCurrentBusiness();
  const updateBusiness = useUpdateBusiness();
  const [pushNotif, setPushNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [locationBg, setLocationBg] = useState(true);

  return (
    <ScreenScaffold title="Settings" subtitle="App preferences and defaults">
      <SettingsGroup title="Business mode">
        <View className="p-4">
          <SegmentedToggle
            options={INDUSTRY_OPTIONS}
            active={mode}
            onChange={async (value) => {
              const nextMode = value as "mobile" | "fixed";
              setMode(nextMode);
              if (business.data) {
                await updateBusiness.mutateAsync({
                  id: business.data.id,
                  patch: { industry_mode: nextMode },
                });
              }
            }}
          />
          <Text className="text-xs text-slate-500 mt-3 leading-4">
            Mobile Service shows route planning and travel maps. Fixed Location
            shows appointment and resource scheduling.
          </Text>
        </View>
      </SettingsGroup>

      <SettingsGroup title="Notifications">
        <SettingsRow
          label="Push notifications"
          chevron={false}
          right={<Switch value={pushNotif} onValueChange={setPushNotif} />}
        />
        <SettingsRow
          label="Email notifications"
          chevron={false}
          right={<Switch value={emailNotif} onValueChange={setEmailNotif} />}
        />
        <SettingsRow label="Quiet hours" value="22:00 – 07:00" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <SettingsRow
          label="Dark mode"
          chevron={false}
          right={<Switch value={darkMode} onValueChange={setDarkMode} />}
        />
        <SettingsRow label="Text size" value="Default" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Location & privacy">
        <SettingsRow
          label="Background location"
          description="Used for route tracking during active jobs"
          chevron={false}
          right={<Switch value={locationBg} onValueChange={setLocationBg} />}
        />
        <SettingsRow label="Data & privacy" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Account">
        <SettingsRow label="Change password" onPress={() => {}} />
        <SettingsRow label="Sign out" destructive onPress={() => {}} />
      </SettingsGroup>
    </ScreenScaffold>
  );
}
