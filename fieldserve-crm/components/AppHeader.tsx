import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { icons } from "../constants/icons";
import NavDrawer from "./NavDrawer";
import { colors } from "@/constants/theme";
import AnimatedIconButton from "./AnimatedIconButton";
import { BlurView } from "expo-blur";
import { useMe } from "../lib/hooks/useMe";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

const ACTIVE_GRADIENT = colors.activeGradient;
const HEADER_TOP_OFFSET = 10;
const HEADER_VERTICAL_PADDING = 10;
const HEADER_CONTENT_HEIGHT = 56;

export const FLOATING_HEADER_CONTENT_OFFSET =
  HEADER_TOP_OFFSET + HEADER_VERTICAL_PADDING * 2 + HEADER_CONTENT_HEIGHT;

type Props = {
  title: string;
  back?: boolean;
};

export default function AppHeader({ title, back }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const me = useMe();
  const AVATAR = [me.data?.first_name?.[0], me.data?.last_name?.[0]];

  return (
    <>
      {/* Floating glassmorphism header */}
      <BlurView
        intensity={100}
        tint="light"
        className="absolute left-0 right-0 top-0 z-10 overflow-hidden mx-4" // mx-4 gives it left/right spacing
        style={{
          marginTop: insets.top + HEADER_TOP_OFFSET, // Push it down from the top safe area
          paddingVertical: HEADER_VERTICAL_PADDING, // Safe, consistent inner padding
          paddingHorizontal: 20, 
          backgroundColor: colors.glass,
          borderColor: colors.glassBorder,
          borderWidth: 1, // Required to see the border
          borderRadius: 20,
          borderCurve: "continuous",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
          elevation: 10, // For Android shadow
        }}
      >
        <View className="h-14 flex-row items-center justify-between px-4 bg-transparent">
          {back ? (
            <AnimatedIconButton
              hitSlop={12}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10"
            >
              <Image
                source={icons.back}
                style={{ width: 22, height: 22, tintColor: colors.primary }}
                resizeMode="contain"
              />
            </AnimatedIconButton>
          ) : (
            <AnimatedIconButton
              hitSlop={12}
              onPress={() => setOpen(true)}
              accessibilityLabel="Open menu"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10"
            >
              <Image
                source={icons.menu}
                style={{ width: 22, height: 22, tintColor: colors.primary }}
                resizeMode="contain"
              />
            </AnimatedIconButton>
          )}

          <MaskedView
            maskElement={
              <Text className="text-base font-semibold flex-1 text-center justify-center align-middle" numberOfLines={1}>
                {title}
              </Text>
            }
          >
            <LinearGradient
              colors={ACTIVE_GRADIENT as [string, string, string]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            >
              
              <Text className="text-base font-semibold flex-1 text-center opacity-0 align-middle" numberOfLines={1}>
                {title}
              </Text>
            </LinearGradient>
          </MaskedView>

          <Pressable   
            hitSlop={12}
            onPress={() => router.push("/profile")}
            accessibilityLabel="Open profile"
            className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10"
          >
            <Text
              className="text-base font-semibold text-primary border rounded-full p-1 border-gray-300"
            >
              {AVATAR.join("")}
            </Text>
          </Pressable>
        </View>
      </BlurView>

      <NavDrawer visible={open} onClose={() => setOpen(false)} />
    </>
  );
}