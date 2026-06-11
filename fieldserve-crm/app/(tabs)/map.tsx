import { View } from "react-native";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import MapFixed from "../../components/screens/MapFixed";
import MapMobile from "../../components/screens/MapMobile";
import { useIndustry } from "../../contexts/IndustryContext";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaVIew} from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaVIew);

export default function Map() {
  const { mode } = useIndustry();
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="Map" />
      {mode === "fixed" ? <MapFixed /> : <MapMobile />}
    </SafeAreaView>
  );
}
