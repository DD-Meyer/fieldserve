import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { icons } from "../constants/icons";
import NavDrawer from "./NavDrawer";

const AVATAR = require("../assets/images/avatar.png");

type Props = {
  title: string;
};

export default function AppHeader({ title }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <View
        style={{ paddingTop: insets.top }}
        className="bg-slate-900"
      >
        <View className="h-14 flex-row items-center justify-between px-4">
          <Pressable
            hitSlop={12}
            onPress={() => setOpen(true)}
            accessibilityLabel="Open menu"
            className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10"
          >
            <Image
              source={icons.menu}
              style={{ width: 22, height: 22, tintColor: "#ffffff" }}
              resizeMode="contain"
            />
          </Pressable>

          <Text className="text-base font-semibold text-white" numberOfLines={1}>
            {title}
          </Text>

          <Pressable
            hitSlop={12}
            onPress={() => router.push("/profile")}
            accessibilityLabel="Open profile"
            className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10"
          >
            <Image
              source={AVATAR}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          </Pressable>
        </View>
      </View>

      <NavDrawer visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
