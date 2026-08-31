import { Tabs } from "expo-router";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { tabs } from "@/constants/data";
import { useEffect, useRef } from "react";
import { Animated, Image, LayoutChangeEvent, Pressable, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/theme";

const ACTIVE_GRADIENT = colors.activeGradient;
const INACTIVE_COLOR = "#676D75";
const NAV_BG = "#1D1F24";

const StandardTabIcon = ({ focused, icon }: { focused: boolean; icon: any }) => {
  return (
    <View style={styles.tabIconWrapper}>
      {!focused ? (
        <Image
          source={icon}
          style={[styles.icon, { tintColor: INACTIVE_COLOR }]}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.icon}>
          <Image
            source={icon}
            style={[styles.icon, { tintColor: ACTIVE_GRADIENT[1] }]}
            resizeMode="contain"
          />
          <MaskedView
            androidRenderingMode="software"
            style={styles.iconOverlay}
            maskElement={<Image source={icon} style={styles.icon} resizeMode="contain" />}
          >
            <LinearGradient
              colors={ACTIVE_GRADIENT as [string, string, string]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.icon}
            />
          </MaskedView>
        </View>
      )}
    </View>
  );
};

const CenterTabIcon = ({ focused, icon }: { focused: boolean; icon: any }) => {
  return (
    <View style={styles.centerMenuContainer}>
      <View style={styles.centerButton}>
        {focused ? 
         (<Image source={icon} style={{
          tintColor: ACTIVE_GRADIENT[1],
          width: 24,
          height: 24,
         }} resizeMode="contain" />

         ):(

         <Image source={icon} style={styles.centerIcon} resizeMode="contain" />)}
        
      </View>
    </View>
  );
};

const FieldServeTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(0);
  const tabWidth = barWidth.current / state.routes.length;

  useEffect(() => {
    if (tabWidth === 0) return;

    Animated.spring(indicatorPosition, {
      toValue: state.index * tabWidth + (tabWidth - 32) / 2,
      useNativeDriver: true,
      speed: 18,
      bounciness: 5,
    }).start();
  }, [indicatorPosition, state.index, tabWidth]);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    barWidth.current = nativeEvent.layout.width;
    indicatorPosition.setValue(
      state.index * (barWidth.current / state.routes.length) +
        (barWidth.current / state.routes.length - 32) / 2,
    );
  };

  return (
    <View onLayout={handleLayout} style={[styles.tabBar, { height: 70 + insets.bottom, paddingBottom: insets.bottom }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.activeTopLine, { transform: [{ translateX: indicatorPosition }] }]}
      />
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const tab = tabs.find((item) => item.name === route.name);
        if (!tab) return null;

        const focused = state.index === index;
        const isCenter = tab.name === "bookings" || tab.name === "scan";
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            style={styles.tabItem}
          >
            {isCenter ? <CenterTabIcon focused={focused} icon={tab.icon} /> : <StandardTabIcon focused={focused} icon={tab.icon} />}
            {!isCenter && <Animated.Text style={[styles.label, { color: focused ? ACTIVE_GRADIENT[1] : INACTIVE_COLOR }]}>{tab.title}</Animated.Text>}
          </Pressable>
        );
      })}
    </View>
  );
};

const TabLayout = () => {
  return (
    <Tabs
      tabBar={(props) => <FieldServeTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {tabs.map((tab) => {
        const isCenter = tab.name === "bookings" || tab.name === "scan";

        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
            }}
          />
        );
      })}
    </Tabs>
  );
};

const styles = StyleSheet.create({
  tabIconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    height: 28,
  },
  activeTopLine: {
    position: "absolute",
    top: 0,
    width: 32,
    height: 2,
    backgroundColor: ACTIVE_GRADIENT[1],
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    flexDirection: "row",
    backgroundColor: NAV_BG,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 24,
    height: 24,
  },
  iconOverlay: {
    position: "absolute",
    width: 24,
    height: 24,
  },
  label: {
    fontFamily: "Poppins",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 1,
  },
  centerMenuContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    height: 52,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
    borderWidth: 4,
    borderColor: NAV_BG,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  centerIcon: {
    width: 24,
    height: 24,
    tintColor: NAV_BG,
  },
});

export default TabLayout;
