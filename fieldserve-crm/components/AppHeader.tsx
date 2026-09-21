import { useRef, useState, type ReactNode } from "react";
import { Image, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { icons } from "../constants/icons";
import NavDrawer from "./NavDrawer";
import { colors } from "@/constants/theme";
import AnimatedIconButton from "./AnimatedIconButton";
import { BlurView } from "expo-blur";
import { useMe } from "../lib/hooks/useMe";
import { useCurrentBusiness } from "../lib/hooks/useBusiness";

const HEADER_TOP_OFFSET = 10;
const HEADER_VERTICAL_PADDING = 10;
const HEADER_CONTENT_HEIGHT = 10;

export const FLOATING_HEADER_CONTENT_OFFSET =
  HEADER_TOP_OFFSET + HEADER_VERTICAL_PADDING * 2 + HEADER_CONTENT_HEIGHT;

type Props = {
  title: string;
  back?: boolean;
  /** Home shows the company + welcome block instead of the screen title. */
  home?: boolean;
  search?: {
    value: string;
    onChange: (text: string) => void;
    placeholder?: string;
  };
  filter?: {
    summary?: string;
    children: ReactNode;
  };
  onShare?: () => void;
};

export default function AppHeader({
  title,
  back,
  home,
  search,
  filter,
  onShare,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(0);
  const headerRef = useRef<View>(null);
  const me = useMe();
  const business = useCurrentBusiness();
  const AVATAR = [me.data?.first_name?.[0], me.data?.last_name?.[0]];
  const FULLNAME = `${me.data?.first_name ?? ""} ${me.data?.last_name ?? ""}`;
  const COMPANYNAME = business.data?.name ?? "";
  const showToolbar = Boolean(search || filter || onShare);

  // The panel lives in a Modal, so it needs the header's on-screen position.
  const toggleFilter = () => {
    if (filterOpen) {
      setFilterOpen(false);
      return;
    }
    headerRef.current?.measureInWindow((_x, y, _width, height) => {
      setPanelTop(y + height);
      setFilterOpen(true);
    });
  };

  return (
    <View ref={headerRef} collapsable={false}>
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


          {home ? (
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
          ) : (
            <View className="flex-1 px-3">
              <Text
                className="text-lg font-black text-center"
                style={{ color: colors.muted }}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
          )}

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

      {showToolbar ? (
        <View className="flex-row items-center gap-2 px-4 pt-3 pb-2">
          {search ? (
            <TextInput
              value={search.value}
              onChangeText={search.onChange}
              placeholder={search.placeholder ?? "Search..."}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              returnKeyType="search"
              className="flex-1 h-11 rounded-full bg-white border border-slate-200 px-4 text-slate-900"
            />
          ) : (
            <View className="flex-1" />
          )}

          {onShare ? (
            <Pressable
              hitSlop={8}
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Share booking page"
              className="h-11 w-11 items-center justify-center rounded-full bg-white border border-slate-200 active:bg-slate-100"
            >
              <Ionicons name="share-social-outline" size={20} color="#334155" />
            </Pressable>
          ) : null}

          {filter ? (
            <Pressable
              hitSlop={8}
              onPress={toggleFilter}
              accessibilityRole="button"
              accessibilityLabel="Filters"
              accessibilityState={{ expanded: filterOpen }}
              className={`h-11 w-11 items-center justify-center rounded-full border ${
                filterOpen ? "bg-slate-900 border-slate-900" : "bg-white border-slate-200"
              }`}
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={filterOpen ? "#ffffff" : "#334155"}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {filter ? (
        <Modal
          transparent
          visible={filterOpen}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setFilterOpen(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              accessibilityLabel="Close filters"
              onPress={() => setFilterOpen(false)}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View
              style={{
                position: "absolute",
                top: panelTop,
                left: 16,
                right: 16,
                elevation: 8,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
              }}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              {filter.summary ? (
                <Text className="text-[11px] text-slate-500 mb-3" numberOfLines={1}>
                  {filter.summary}
                </Text>
              ) : null}
              {filter.children}
            </View>
          </View>
        </Modal>
      ) : null}

      <NavDrawer visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}