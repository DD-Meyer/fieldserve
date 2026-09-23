import {
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

import ScreenScaffold from "../components/ScreenScaffold";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";
import { ApiError } from "../lib/api";
import { useCurrentBusiness, useDeleteBusiness } from "../lib/hooks/useBusiness";
import { useMe } from "../lib/hooks/useMe";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const business = useCurrentBusiness();
  const deleteBusiness = useDeleteBusiness();
  const me = useMe();

  const deleteCurrentBusiness = () => {
    const currentBusiness = business.data;
    if (!currentBusiness || currentBusiness.role !== "admin") {
      Alert.alert("Owner access required", "Only the business owner can delete this business account.");
      return;
    }

    Alert.alert(
      "Delete business account?",
      "This is irreversible. It permanently deletes this business, all bookings, customers, services, team memberships, inspections, and associated data. Any future pending bookings are cancelled automatically. Deletion is blocked while any booking is in progress or confirmed. Your Clerk login remains available for other businesses.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            void deleteBusiness.mutateAsync(currentBusiness.id).then(() => signOut()).catch((e: unknown) => {
              const message =
                e instanceof ApiError ? e.message : "Please try again when you have a connection.";
              Alert.alert("Business was not deleted", message);
            });
          },
        },
      ],
    );
  };

  return (
    <ScreenScaffold title="Settings" subtitle="App preferences and defaults">
      {me.isLoading || business.isLoading ? <ActivityIndicator className="mb-4" /> : null}

      <SettingsGroup title="Privacy">
        <SettingsRow label="Data privacy" onPress={() => router.push("/privacy")} />
      </SettingsGroup>

      <SettingsGroup title="Account">
        <SettingsRow label="Change password" onPress={() => router.push("/profile")} />
        <SettingsRow
          label="Sign out"
          destructive
          onPress={() => {
            void signOut();
          }}
        />
        <SettingsRow label="Delete business account" destructive onPress={deleteCurrentBusiness} />
      </SettingsGroup>
    </ScreenScaffold>
  );
}
