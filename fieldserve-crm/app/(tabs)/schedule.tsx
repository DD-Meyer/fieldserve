import { View } from "react-native";
import "../../global.css";

import AppHeader, {
  FLOATING_HEADER_CONTENT_OFFSET,
} from "../../components/AppHeader";
import ScheduleFixed from "../../components/screens/ScheduleFixed";
import ScheduleMobile from "../../components/screens/ScheduleMobile";
import { useIndustry } from "../../contexts/IndustryContext";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaVIew} from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaVIew);

export default function Schedule() {
  const { mode } = useIndustry();
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="Schedule" />
      <View style={{ flex: 1, paddingTop: FLOATING_HEADER_CONTENT_OFFSET }}>
        {mode === "fixed" ? <ScheduleFixed /> : <ScheduleMobile />}
      </View>
    </SafeAreaView>
  );
}
