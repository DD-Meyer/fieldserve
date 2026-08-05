import { Image, Text, View } from "react-native";

import ScreenScaffold from "../components/ScreenScaffold";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";
import { useAuth } from "@clerk/clerk-expo";

const AVATAR = require("../assets/images/avatar.png");


export default function ProfileScreen() {
  // Extract signOut from the useAuth hook
  const { signOut } = useAuth(); 

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <ScreenScaffold
      title="Profile"
      rightAction={{ label: "Edit", onPress: () => {} }}
    >
      <View className="bg-white rounded-2xl border border-slate-200 p-5 items-center mb-5">
        <Image source={AVATAR} style={{ width: 80, height: 80, borderRadius: 40 }} />
        <Text className="mt-3 text-lg font-semibold text-slate-900">Your Name</Text>
        <Text className="text-sm text-slate-500">Owner · FieldServe Detailing</Text>
        <Text className="text-xs text-slate-400 mt-1">owner@fieldserve.local</Text>
      </View>

      <SettingsGroup title="Account">
        <SettingsRow label="Personal details" onPress={() => {}} />
        <SettingsRow label="Change password" onPress={() => {}} />
        <SettingsRow label="Two-factor auth" value="Off" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsRow label="Notifications" onPress={() => {}} />
        <SettingsRow label="Language" value="English (UK)" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label="Sign out" destructive onPress={handleSignOut} />
      </SettingsGroup>
    </ScreenScaffold>
  );
}
