import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MenuItem = {
  label: string;
  route: Href;
  description?: string;
};

const MENU: MenuItem[] = [
  { label: "Services", route: "/services", description: "Manage offerings & pricing" },
  { label: "Team Management", route: "/team", description: "Staff, roles & assignments" },
  { label: "Company Info", route: "/company", description: "Business profile" },
  { label: "Billing", route: "/billing", description: "Plan & invoices" },
  { label: "Indemnity Settings", route: "/indemnity", description: "Liability & waivers" },
  { label: "Settings", route: "/settings", description: "App preferences" },
  { label: "Support", route: "/support", description: "Help & contact" },
];

const DRAWER_WIDTH = Math.min(320, Dimensions.get("window").width * 0.85);

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function NavDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -DRAWER_WIDTH,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateX, fade]);

  const go = (route: Href) => {
    onClose();
    // Defer navigation so the drawer animates out cleanly.
    setTimeout(() => router.push(route), 180);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1">
        <Animated.View
          style={{ opacity: fade }}
          className="absolute inset-0 bg-black/40"
        >
          <Pressable className="flex-1" onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            width: DRAWER_WIDTH,
            transform: [{ translateX }],
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
          }}
          className="h-full bg-white shadow-2xl"
        >
          <View className="px-5 pb-4 border-b border-slate-200">
            <Text className="text-xs uppercase tracking-wider text-slate-500">
              FieldServe CRM
            </Text>
            <Text className="text-lg font-semibold text-slate-900 mt-1">
              Menu
            </Text>
          </View>

          <ScrollView className="flex-1">
            {MENU.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => go(item.route)}
                className="px-5 py-4 border-b border-slate-100 active:bg-slate-50"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-medium text-slate-900">
                      {item.label}
                    </Text>
                    {item.description ? (
                      <Text className="text-xs text-slate-500 mt-0.5">
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-slate-400 text-lg">›</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View className="px-5 pt-3 border-t border-slate-200">
            <Text className="text-xs text-slate-400">v0.1.0</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
