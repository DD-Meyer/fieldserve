import { Image, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";

import ScreenScaffold from "../components/ScreenScaffold";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useMe, useUpdateMe } from "../lib/hooks/useMe";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const me = useMe();
  const updateMe = useUpdateMe();
  const [editOpen, setEditOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const membership = me.data?.memberships[0];
  const displayName = [me.data?.first_name, me.data?.last_name]
    .filter(Boolean)
    .join(" ");
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const openEdit = () => {
    setFirstName(me.data?.first_name ?? "");
    setLastName(me.data?.last_name ?? "");
    setPhone(me.data?.phone ?? "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    await updateMe.mutateAsync({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
    });
    setEditOpen(false);
  };

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
      rightAction={{ label: "Edit", onPress: openEdit }}
    >
      <View className="bg-white rounded-2xl border border-slate-200 p-5 items-center mb-5">
        {user?.imageUrl ? (
          <Image source={{ uri: user.imageUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} />
        ) : (
          <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center">
            <Text className="text-2xl font-semibold text-blue-700">{initials}</Text>
          </View>
        )}
        <Text className="mt-3 text-lg font-semibold text-slate-900">
          {displayName || me.data?.email || "Profile"}
        </Text>
        <Text className="text-sm text-slate-500">
          {[membership?.role, membership?.business_name].filter(Boolean).join(" · ")}
        </Text>
        <Text className="text-xs text-slate-400 mt-1">
          {user?.primaryEmailAddress?.emailAddress ?? me.data?.email}
        </Text>
      </View>

      <SettingsGroup title="Account">
        <SettingsRow label="Personal details" onPress={openEdit} />
        <SettingsRow
          label="Email"
          value={user?.primaryEmailAddress?.emailAddress ?? me.data?.email}
          chevron={false}
        />
        <SettingsRow label="Phone" value={me.data?.phone} onPress={openEdit} />
        <SettingsRow
          label="Two-factor auth"
          value={user?.twoFactorEnabled ? "On" : "Off"}
          chevron={false}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label="Sign out" destructive onPress={handleSignOut} />
      </SettingsGroup>

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <View className="flex-1 justify-center bg-black/40 px-6">
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-base font-semibold text-slate-900 mb-3">
              Personal details
            </Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 mb-3"
            />
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 mb-3"
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              keyboardType="phone-pad"
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 mb-3"
            />
            <View className="flex-row justify-end">
              <Pressable onPress={() => setEditOpen(false)} className="px-4 py-2">
                <Text className="text-slate-600">Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEdit} className="px-4 py-2 bg-blue-600 rounded-lg ml-2">
                <Text className="text-white font-semibold">
                  {updateMe.isPending ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}
