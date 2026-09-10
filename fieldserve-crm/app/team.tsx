import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import ScreenScaffold from "../components/ScreenScaffold";
import { useCurrentBusiness } from "../lib/hooks/useBusiness";
import {
  type TeamMember,
  useDeactivateTeamMember,
  useInviteTeamMember,
  useTeamMembers,
  useUpdateTeamMember,
} from "../lib/hooks/useTeam";

const statusTone = {
  active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
  invited: { bg: "bg-amber-100", text: "text-amber-700", label: "Invited" },
  inactive: { bg: "bg-slate-100", text: "text-slate-500", label: "Inactive" },
};

function displayName(member: TeamMember) {
  const name = `${member.user_first_name ?? ""} ${member.user_last_name ?? ""}`.trim();
  return name || member.user_email || member.invited_email || "Team member";
}

function errorMessage(error: any) {
  const body = error?.body;
  if (typeof body === "string") return body;
  if (body?.detail) return String(body.detail);
  return error?.message || "Something went wrong.";
}

export default function TeamScreen() {
  const { data: business } = useCurrentBusiness();
  const isAdmin = business?.role === "admin";
  const members = useTeamMembers(isAdmin ? business?.id ?? null : null);
  const invite = useInviteTeamMember();
  const update = useUpdateTeamMember();
  const deactivate = useDeactivateTeamMember();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("staff");
  const [error, setError] = useState<string | null>(null);

  const sendInvite = async () => {
    if (!business || !email.trim()) {
      setError("Enter the team member's email address.");
      return;
    }
    setError(null);
    try {
      await invite.mutateAsync({ businessId: business.id, email: email.trim(), role });
      setEmail("");
      setRole("staff");
      setInviteOpen(false);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const changeRole = async (member: TeamMember) => {
    if (!business) return;
    const role = member.role === "admin" ? "staff" : "admin";
    try {
      await update.mutateAsync({ businessId: business.id, memberId: member.id, role });
    } catch (requestError) {
      Alert.alert("Role not changed", errorMessage(requestError));
    }
  };

  const removeMember = (member: TeamMember) => {
    if (!business) return;
    const isInvitation = member.status === "invited";
    Alert.alert(
      isInvitation ? "Cancel invitation" : "Remove team member",
      isInvitation
        ? `Cancel the pending invitation for ${displayName(member)}?`
        : `Remove ${displayName(member)} from this company?`,
      [
      { text: "Cancel", style: "cancel" },
      {
        text: isInvitation ? "Cancel invite" : "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deactivate.mutateAsync({ businessId: business.id, memberId: member.id });
          } catch (requestError) {
            Alert.alert("Member not removed", errorMessage(requestError));
          }
        },
      },
      ],
    );
  };

  return (
    <ScreenScaffold
      title="Team Management"
      subtitle="Invite Staff, assign Admin access, and manage active members."
      rightAction={isAdmin ? { label: "Invite", onPress: () => setInviteOpen(true) } : undefined}
    >
      {!isAdmin ? (
        <View className="bg-white rounded-xl border border-slate-200 p-5">
          <Text className="text-sm font-semibold text-slate-900">Admin access required</Text>
          <Text className="text-xs text-slate-500 mt-1">Only Admins can view and manage the company team.</Text>
        </View>
      ) : members.isLoading ? (
        <View className="bg-white rounded-xl border border-slate-200 p-6 items-center">
          <ActivityIndicator />
        </View>
      ) : members.error ? (
        <View className="bg-white rounded-xl border border-slate-200 p-5">
          <Text className="text-sm text-red-600">{errorMessage(members.error)}</Text>
        </View>
      ) : (members.data?.length ?? 0) === 0 ? (
        <View className="bg-white rounded-xl border border-slate-200 p-5">
          <Text className="text-sm font-semibold text-slate-900">No team members yet</Text>
          <Text className="text-xs text-slate-500 mt-1">Invite a Staff member to start assigning work.</Text>
        </View>
      ) : (
        <View className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {members.data?.map((member, index) => {
            const tone = statusTone[member.status];
            const initial = displayName(member).slice(0, 1).toUpperCase();
            const canManage = member.status !== "inactive";
            return (
              <View key={member.id} className={`px-4 py-3 ${index ? "border-t border-slate-100" : ""}`}>
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
                    <Text className="text-sm font-bold text-blue-700">{initial}</Text>
                  </View>
                  <View className="flex-1 pl-3">
                    <Text className="text-sm font-semibold text-slate-900">{displayName(member)}</Text>
                    <Text className="text-xs text-slate-500 mt-0.5">{member.user_email || member.invited_email}</Text>
                  </View>
                  <View className={`px-2 py-0.5 rounded-full ${tone.bg}`}>
                    <Text className={`text-[10px] font-semibold ${tone.text}`}>{tone.label}</Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between mt-3 ml-13">
                  <Text className="text-xs font-semibold text-slate-600 capitalize">{member.role}</Text>
                  {canManage ? (
                    <View className="flex-row gap-3">
                      {member.status === "active" ? (
                        <Pressable onPress={() => changeRole(member)} disabled={update.isPending}>
                          <Text className="text-xs font-semibold text-blue-600">Make {member.role === "admin" ? "Staff" : "Admin"}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => removeMember(member)} disabled={deactivate.isPending}>
                        <Text className="text-xs font-semibold text-red-600">{member.status === "invited" ? "Cancel invite" : "Remove"}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl p-5">
            <Text className="text-lg font-bold text-slate-900">Invite team member</Text>
            <Text className="text-xs text-slate-500 mt-1 mb-4">Clerk will send an email invitation.</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="name@example.com"
              className="border border-slate-200 rounded-lg px-3 py-3 text-slate-900"
            />
            <View className="flex-row gap-2 mt-3">
              {(["staff", "admin"] as const).map((candidate) => (
                <Pressable key={candidate} onPress={() => setRole(candidate)} className={`flex-1 rounded-lg py-2 items-center border ${role === candidate ? "bg-blue-600 border-blue-600" : "border-slate-200"}`}>
                  <Text className={`text-xs font-semibold capitalize ${role === candidate ? "text-white" : "text-slate-700"}`}>{candidate}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text className="text-xs text-red-600 mt-3">{error}</Text> : null}
            <View className="flex-row gap-3 mt-5">
              <Pressable onPress={() => setInviteOpen(false)} className="flex-1 border border-slate-200 rounded-lg py-3 items-center">
                <Text className="text-sm font-semibold text-slate-700">Cancel</Text>
              </Pressable>
              <Pressable onPress={sendInvite} disabled={invite.isPending} className="flex-1 bg-blue-600 rounded-lg py-3 items-center">
                {invite.isPending ? <ActivityIndicator color="white" /> : <Text className="text-sm font-semibold text-white">Send invite</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}
