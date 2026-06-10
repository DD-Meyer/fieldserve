import { View } from "react-native";
import "../../global.css";

import AppHeader from "../../components/AppHeader";
import MapFixed from "../../components/screens/MapFixed";
import MapMobile from "../../components/screens/MapMobile";
import { useIndustry } from "../../contexts/IndustryContext";

export default function Map() {
  const { mode } = useIndustry();
  return (
    <View className="flex-1 bg-slate-50">
      <AppHeader title="Map" />
      {mode === "fixed" ? <MapFixed /> : <MapMobile />}
    </View>
  );
}
