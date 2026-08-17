import { Tabs } from "expo-router";
import { tabs } from "@/constants/data";
import { colors, components } from "@/constants/theme";
import "../../global.css";
import { Image, View, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabBar = components.tabBar;

const TabLayout = () => {
  const insets = useSafeAreaInsets();
  // Lift the bar above the device's home indicator / gesture area
  const bottomOffset = insets.bottom > 0 ? insets.bottom + 12 : 20;

  const StandardTabIcon = ({ focused, icon }: { focused: boolean; icon: any }) => {
    const iconColor = focused ? colors.background : colors.primary;
    return (
      <View
        style={[
          styles.standardIconContainer,
          { backgroundColor: focused ? colors.primary : "transparent" },
        ]}
      >
        <Image
          source={icon}
          style={{ width: 22, height: 22, tintColor: iconColor }}
          resizeMode="contain"
        />
      </View>
    );
  };

  const CenterTabIcon = ({ focused, icon }: { focused: boolean; icon: any }) => {
    return (
      <View
        style={[
          styles.centerIconContainer,
          { backgroundColor: focused ? colors.primary : colors.nav },
        ]}
      >
        <Image
          source={icon}
          style={{
            width: 28,
            height: 28,
            tintColor: focused ? colors.background : colors.primary,
          }}
          resizeMode="contain"
        />
      </View>
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: bottomOffset,
          height: tabBar.height,
          marginHorizontal: tabBar.horizontalInset,
          borderRadius: tabBar.radius,
          backgroundColor: colors.nav,
          borderColor: colors.border,
          borderWidth: 1,
          elevation: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          height: tabBar.height,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: "2.5%",
          paddingBottom: 0,
        },
      }}
    >
      {tabs.map((tab) => {
        const isCenter = tab.name === "bookings";

        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ focused }) =>
                isCenter ? (
                  <CenterTabIcon focused={focused} icon={tab.icon} />
                ) : (
                  <StandardTabIcon focused={focused} icon={tab.icon} />
                ),
            }}
          />
        );
      })}
    </Tabs>
  );
};

const styles = StyleSheet.create({
  standardIconContainer: {
    width: tabBar.iconFrame,
    height: tabBar.iconFrame,
    borderRadius: tabBar.iconFrame / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  centerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28, // Negative vertical shift to lift it above the bar
    borderWidth: 3,
    borderColor: colors.border,
    // Optional shadow for the floating circle effect
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
});

export default TabLayout;