import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { IndustryProvider } from "../contexts/IndustryContext";
import '@/global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <IndustryProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </IndustryProvider>
    </SafeAreaProvider>
  );
}
