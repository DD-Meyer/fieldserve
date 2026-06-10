import { Switch, Text, View } from "react-native";
import { useState } from "react";

import ScreenScaffold from "../components/ScreenScaffold";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";

export default function IndemnityScreen() {
  const [requireSignature, setRequireSignature] = useState(true);
  const [photoEvidence, setPhotoEvidence] = useState(true);
  const [autoEmail, setAutoEmail] = useState(false);

  return (
    <ScreenScaffold
      title="Indemnity Settings"
      subtitle="Liability waivers and pre-job acknowledgements"
    >
      <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 flex-row">
        <Text className="text-amber-700 mr-2">ⓘ</Text>
        <Text className="text-amber-800 text-xs leading-4 flex-1">
          These settings affect every job created from now on. Existing jobs are
          not modified.
        </Text>
      </View>

      <SettingsGroup title="Customer waiver">
        <SettingsRow
          label="Require digital signature"
          description="Customer signs on device before job starts"
          chevron={false}
          right={
            <Switch value={requireSignature} onValueChange={setRequireSignature} />
          }
        />
        <SettingsRow
          label="Photo evidence on arrival"
          description="Worker uploads vehicle photos before work begins"
          chevron={false}
          right={
            <Switch value={photoEvidence} onValueChange={setPhotoEvidence} />
          }
        />
        <SettingsRow
          label="Email copy to customer"
          chevron={false}
          right={<Switch value={autoEmail} onValueChange={setAutoEmail} />}
        />
      </SettingsGroup>

      <SettingsGroup title="Templates">
        <SettingsRow
          label="Standard waiver text"
          description="Last edited 12 May 2026"
          onPress={() => {}}
        />
        <SettingsRow
          label="Damage disclaimer"
          description="Used for ceramic coating and paint correction"
          onPress={() => {}}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Coverage"
        footer="Public liability insurance details are shown on customer receipts."
      >
        <SettingsRow label="Insurance provider" value="Hiscox" onPress={() => {}} />
        <SettingsRow label="Policy number" value="HX-0048221" onPress={() => {}} />
        <SettingsRow label="Cover limit" value="£2,000,000" onPress={() => {}} />
      </SettingsGroup>
    </ScreenScaffold>
  );
}
