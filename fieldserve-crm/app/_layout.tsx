import { ClerkLoaded, ClerkLoading, ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { IndustryProvider } from "../contexts/IndustryContext";
import { tokenCache } from "../lib/clerk";
import "@/global.css";
import { useFonts } from "expo-font";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

console.log(
  "[FieldServe] Clerk key present?",
  Boolean(CLERK_PUBLISHABLE_KEY),
  "prefix:",
  CLERK_PUBLISHABLE_KEY?.slice(0, 12) ?? "(none)",
);

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Auth screens will not work.",
  );
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inPublicGroup = segments[0] === "book";
    console.log("[FieldServe] AuthGate effect", {
      isSignedIn,
      firstSegment: segments[0],
      inAuthGroup,
      inPublicGroup,
    });
    if (inPublicGroup) return;
    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "sans-light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
    "sans-regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "sans-medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "sans-semibold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "sans-bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "sans-extrabold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const queryClient = useMemo(() => new QueryClient(), []);

  if (!fontsLoaded) {
    return null;
  }

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" }}>
        <Text style={{ fontWeight: "600", marginBottom: 8 }}>Missing Clerk key</Text>
        <Text style={{ textAlign: "center", color: "#475569" }}>
          EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY isn&apos;t set. Make sure
          {"\n"}fieldserve-crm/.env.local exists, then restart with{"\n"}
          <Text style={{ fontFamily: "monospace" }}>npx expo start -c</Text>.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoading>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12, color: "#64748b" }}>Connecting to FieldServe…</Text>
        </View>
      </ClerkLoading>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <IndustryProvider>
              <AuthGate />
            </IndustryProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
