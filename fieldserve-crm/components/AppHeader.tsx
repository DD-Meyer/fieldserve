import { useRef, useState, type ReactNode } from "react";
import { Image, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { icons } from "../constants/icons";
import NavDrawer from "./NavDrawer";
import { colors } from "@/constants/theme";
import AnimatedIconButton from "./AnimatedIconButton";
import { useMe } from "../lib/hooks/useMe";
import { useCurrentBusiness } from "../lib/hooks/useBusiness";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const HEADER_TOP_OFFSET = 10;
const HEADER_VERTICAL_PADDING = 20;
const HEADER_ROW_HEIGHT = 56; // matches className "h-14" on the top row

// The compact bar's height never animates - it's known up front and stays
// fixed. That's what makes the collapse smooth even on a slow, tracked drag:
// nothing about it forces a layout recalculation.
export const COMPACT_HEADER_HEIGHT = HEADER_TOP_OFFSET + HEADER_ROW_HEIGHT + HEADER_VERTICAL_PADDING;

// Height of the greeting + stats overlay when fully visible. Home screens
// should reserve this much top padding on their ScrollView's content so the
// first real content starts right where the overlay's bottom edge sits.
export const HOME_HEADER_EXTRA_HEIGHT = 170;

// How much scroll distance (px) the collapse plays out over.
const COLLAPSE_DISTANCE = 80;

// Kept for any screen still importing the old constant - no longer used
// internally now that the header doesn't float over content by default.
export const FLOATING_HEADER_CONTENT_OFFSET = COMPACT_HEADER_HEIGHT;

export type HeaderStat = {
  label: string;
  value: string;
};

type Props = {
  title: string;
  back?: boolean;
  /** Home shows the greeting + stats overlay instead of the screen title, and collapses on scroll. */
  home?: boolean;
  /** Stat chips shown in the overlay on the home screen (e.g. Jobs Today, Revenue, Pending). */
  stats?: HeaderStat[];
  /** Unread notification count. Renders a bell with a badge when > 0, or just the bell when 0. */
  notificationCount?: number;
  onNotificationPress?: () => void;
  /**
   * Reanimated shared value driven by the home screen's scroll position, used to collapse the
   * header smoothly on the UI thread. Only relevant when `home` is true - create it with
   * `useSharedValue(0)` and update it in a `useAnimatedScrollHandler` on the screen's ScrollView.
   */
  scrollY?: SharedValue<number>;
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatHeaderDate(date: Date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString(undefined, { month: "long" });
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

export default function AppHeader({
  title,
  back,
  home,
  stats,
  notificationCount = 0,
  onNotificationPress,
  scrollY,
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
  const FULLNAME = `${me.data?.first_name ?? ""} ${me.data?.last_name ?? ""}`.trim();
  const COMPANYNAME = business.data?.name ?? "";
  const showToolbar = Boolean(search || filter || onShare);

  // Fallback so the header still renders (fully expanded, static) if a screen
  // forgets to wire up scrollY. Hooks always run, so this is safe even when unused.
  const fallbackScrollY = useSharedValue(0);
  const y = scrollY ?? fallbackScrollY;

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

  // Purely a paint-level property (doesn't affect layout of siblings), so
  // it's cheap to animate alongside the transform/opacity below.
  const compactCornerAnimatedStyle = useAnimatedStyle(() => {
    if (!home) return {};
    const radius = interpolate(y.value, [0, COLLAPSE_DISTANCE], [0, 24], Extrapolation.CLAMP);
    return { borderBottomLeftRadius: radius, borderBottomRightRadius: radius };
  });

  const compactTitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP),
  }));

  // The overlay only ever animates transform + opacity - never height,
  // padding, or anything else that would force a layout pass. That's the
  // fix for the stutter: a transform is handled entirely by the
  // compositor, so it stays smooth no matter how slowly you drag.
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, COLLAPSE_DISTANCE], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          y.value,
          [0, COLLAPSE_DISTANCE],
          [0, -HOME_HEADER_EXTRA_HEIGHT],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  return (
    <View ref={headerRef} collapsable={false} style={{ zIndex: 10, elevation: 10 }}>
      <AnimatedLinearGradient
        colors={[colors.primary, "#0B1B4D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          {
            paddingTop: HEADER_TOP_OFFSET,
            paddingHorizontal: 20,
            paddingBottom: HEADER_VERTICAL_PADDING,
            borderBottomRightRadius: home ? 0 : 24,
            borderBottomLeftRadius: home ? 0 : 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 6,
            zIndex: 2,
          },
          home ? compactCornerAnimatedStyle : null,
        ]}
      >
        <View className="h-14 flex-row items-center justify-between">
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

          {!home ? (
            <View className="flex-1 px-3">
              <Text
                className="text-lg font-black text-center"
                style={{ color: colors.muted }}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
          ) : (
            <View className="flex-1 px-3">
              {/* Fades in once the overlay has collapsed, so the bar reads
                  like the compact header used on other screens. */}
              <Animated.Text
                className="text-lg font-black text-center"
                style={[{ color: colors.muted }, compactTitleAnimatedStyle]}
                numberOfLines={1}
              >
                {COMPANYNAME}
              </Animated.Text>
            </View>
          )}

          <View className="flex-row items-center gap-3">
            {home ? (
              <Pressable
                hitSlop={10}
                onPress={onNotificationPress}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10"
              >
                <View>
                  <Ionicons name="notifications-outline" size={22} color={colors.muted} />
                  {notificationCount > 0 ? (
                    <View
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: "#EF4444",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 3,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ) : null}

            <Pressable
              hitSlop={12}
              onPress={() => router.push("/profile")}
              accessibilityLabel="Open profile"
              className="items-center justify-center rounded-full active:bg-white/10"
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
              >
                <Text className="text-sm font-black" style={{ color: colors.muted }}>
                  {AVATAR.join("").toUpperCase()}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </AnimatedLinearGradient>

      {home ? (
        // Absolutely positioned over the screen's ScrollView (which reserves
        // HOME_HEADER_EXTRA_HEIGHT of top padding for it). Sits at a lower
        // zIndex than the compact bar above, so as it translates upward it
        // visually tucks away behind the bar rather than covering it.
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: COMPACT_HEADER_HEIGHT,
              left: 0,
              right: 0,
              height: HOME_HEADER_EXTRA_HEIGHT,
              zIndex: 1,
            },
            overlayAnimatedStyle,
          ]}
        >
          <LinearGradient
            colors={["#0B1B4D", "#061335"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              flex: 1,
              paddingHorizontal: 20,
              paddingBottom: 20,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              overflow: "hidden",
            }}
          >
            <View className="mt-1">
              <Text className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                {getGreeting()}
              </Text>
              <Text className="text-2xl font-black" style={{ color: colors.muted }} numberOfLines={1}>
                {FULLNAME}
              </Text>
              <Text className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }} numberOfLines={1}>
                {`${formatHeaderDate(new Date())} · ${COMPANYNAME}`}
              </Text>
            </View>

            {stats && stats.length > 0 ? (
              <View className="flex-row mt-4 gap-3">
                {stats.map((stat) => (
                  <View
                    key={stat.label}
                    style={{
                      flex: 1,
                      borderRadius: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      backgroundColor: "rgba(255,255,255,0.10)",
                    }}
                  >
                    <Text
                      className="text-lg font-black text-center"
                      style={{ color: "#fff" }}
                      numberOfLines={1}
                    >
                      {stat.value}
                    </Text>
                    <Text
                      className="text-[11px] text-center mt-1"
                      style={{ color: "rgba(255,255,255,0.65)" }}
                      numberOfLines={1}
                    >
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </LinearGradient>
        </Animated.View>
      ) : null}

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
