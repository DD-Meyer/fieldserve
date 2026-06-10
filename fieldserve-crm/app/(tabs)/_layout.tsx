import { Tabs } from "expo-router";
import { tabs } from "../../constants/data";
import "../../global.css";
import { View } from "react-native";
import { clsx } from "clsx";
import { Image } from "expo-image";
import {useSafeAreaInsets} from "react-native-safe-area-context";

const ACTIVE_COLOR = "#2563eb";
const INACTIVE_COLOR = "#6b7280";

const TabLayout = () => {
  const insets = useSafeAreaInsets();
  const TabIcon = ({ focused, icon }: TabIconProps) => {
    return (
      <View className="items-center justify-center">
        <View
          className={clsx(
            "h-12 w-12 items-center justify-center rounded-full",
            focused && "bg-blue-100"
          )}
        >
          <Image
            source={icon}
            style={{
              width: 24,
              height: 24,
              tintColor: focused ? ACTIVE_COLOR : INACTIVE_COLOR,
            }}
            contentFit="contain"
          />
        </View>
      </View>
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 6,
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