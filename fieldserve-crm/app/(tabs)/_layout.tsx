import { Tabs } from "expo-router";
import { tabs } from "@/constants/data";
import { colors, components } from "@/constants/theme";
import "../../global.css";
import { Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabBar = components.tabBar;

const TabLayout = () => {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 50);

  const TabIcon = ({ focused, icon }: TabIconProps) => {
    const iconColor = focused ? colors.background : colors.primary;
    return (
      <View
        style={{
          width: tabBar.iconFrame,
          height: tabBar.iconFrame,
          borderRadius: tabBar.iconFrame / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? colors.primary : "transparent",
        }}
      >
        <Image
          source={icon}
          style={{
            width: 22,
            height: 22,
            tintColor: iconColor,
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
          elevation: 0,
        },

        tabBarItemStyle: {
          paddingVertical: tabBar.height / 2 - tabBar.iconFrame / 1.6
        },

        tabBarIconStyle: {
          width: tabBar.iconFrame,
          height: tabBar.iconFrame,
          alignItems: "center",
        },

      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon={tab.icon} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
};

export default TabLayout;