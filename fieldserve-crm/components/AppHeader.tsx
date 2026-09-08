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
import { useCurrentBusiness } from "../lib/hooks/useBusiness";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { SearchBar } from "react-native-screens";

const ACTIVE_GRADIENT = colors.activeGradient;
const HEADER_TOP_OFFSET = 10;
const HEADER_VERTICAL_PADDING = 10;
const HEADER_CONTENT_HEIGHT = 10;

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
  const business = useCurrentBusiness();
  const AVATAR = [me.data?.first_name?.[0], me.data?.last_name?.[0]];
  const FULLNAME = `${me.data?.first_name ?? ""} ${me.data?.last_name ?? ""}`;
  const COMPANYNAME = business.data?.name ?? "";

  return (
    <>
      {/* Large fullscreen style header */}

      <BlurView
        intensity={10}
        tint="light"
        className="left-0 right-0 top-0" // mx-4 gives it left/right spacing
        style={{
          marginTop: 0,
          marginBottom: 0,
          backgroundColor: colors.primary,
          paddingHorizontal: 20,
          borderBottomRightRadius: 20,
          borderBottomLeftRadius: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <View className="h-30 flex-row items-center justify-between bg-transparent">

          {back ? (
            <AnimatedIconButton
              hitSlop={12}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10"
            >
              <Image
                source={icons.back}
                style={{ width: 22, height: 22, tintColor: colors.muted }}
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
                style={{ width: 22, height: 22, tintColor: colors.muted }}
                resizeMode="contain"
              />
            </AnimatedIconButton>
          )}


          <View className="flex-col items-start">
            <Text className="text-xl font-medium text-center justify-center align-middle"
            style={{ textAlignVertical: "center",
              color: colors.muted,
            }}
            numberOfLines={1}>
              {COMPANYNAME}
            </Text>

            <Text className="text-base font-black text-center justify-center align-middle"
            style={{ textAlignVertical: "center",
              color: colors.muted,
            }}
            numberOfLines={1}>
              {`Welcome, ${FULLNAME.toUpperCase()}`}
            </Text>
          </View>

          <Pressable   
            hitSlop={12}
            onPress={() => router.push("/profile")}
            accessibilityLabel="Open profile"
            className="items-center justify-center rounded-full active:bg-white/10"
          >
            <Text
              className="text-base font-black text-muted border w-10 h-10 text-center rounded-full p-2 border-gray-300"
            >
              {AVATAR.join("").toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </BlurView>

      <NavDrawer visible={open} onClose={() => setOpen(false)} />
    </>
  );
}