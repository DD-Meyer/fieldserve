import { View } from "react-native";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import ScheduleFixed from "../../components/screens/ScheduleFixed";
import ScheduleMobile from "../../components/screens/ScheduleMobile";
import { useIndustry } from "../../contexts/IndustryContext";

export default function Schedule() {
  const { mode } = useIndustry();
  return (
    <View className="flex-1 bg-slate-50">
      <AppHeader title="Schedule" />
      {mode === "fixed" ? <ScheduleFixed /> : <ScheduleMobile />}
    </View>
  );
}
