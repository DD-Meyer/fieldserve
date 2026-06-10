import { Image, Text, View } from "react-native";
import ScreenScaffold from "../components/ScreenScaffold";

const AVATAR = require("../assets/images/avatar.png");

type Member = {
  id: string;
  name: string;
  role: "Owner" | "Worker" | "Admin";
  status: "active" | "invited" | "inactive";
  jobsToday: number;
};

const MEMBERS: Member[] = [
  { id: "1", name: "You", role: "Owner", status: "active", jobsToday: 0 },
  { id: "2", name: "Daniel Carter", role: "Worker", status: "active", jobsToday: 4 },
  { id: "3", name: "Mia Hassan", role: "Worker", status: "active", jobsToday: 3 },
  { id: "4", name: "Jordan Reyes", role: "Admin", status: "invited", jobsToday: 0 },
  { id: "5", name: "Sam Wright", role: "Worker", status: "inactive", jobsToday: 0 },
];

const statusTone = {
  active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
  invited: { bg: "bg-amber-100", text: "text-amber-700", label: "Invited" },
  inactive: { bg: "bg-slate-100", text: "text-slate-500", label: "Inactive" },
};

export default function TeamScreen() {
  return (
    <ScreenScaffold
      title="Team Management"
      subtitle="Staff, roles and job assignments"
      rightAction={{ label: "Invite", onPress: () => {} }}
    >
      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {MEMBERS.map((m, i) => {
          const t = statusTone[m.status];
          return (
            <View
              key={m.id}
              className={
                "px-4 py-3.5 flex-row items-center " +
                (i < MEMBERS.length - 1 ? "border-b border-slate-100" : "")
              }
            >
              <Image
                source={AVATAR}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
              <View className="flex-1 pl-3">
                <Text className="text-[15px] font-semibold text-slate-900">
                  {m.name}
                </Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  {m.role} · {m.jobsToday} jobs today
                </Text>
              </View>
              <View className={`px-2 py-0.5 rounded-full ${t.bg}`}>
                <Text className={`text-[10px] font-semibold ${t.text}`}>
                  {t.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScreenScaffold>
  );
}
