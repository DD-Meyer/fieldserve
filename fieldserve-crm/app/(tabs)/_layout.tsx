import { Tabs } from "expo-router";
import { tabs } from "@/constants/data";
import { Image, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";

const ACTIVE_GRADIENT = colors.activeGradient;
const INACTIVE_COLOR = "#676D75";
const NAV_BG = "#1D1F24";

const StandardTabIcon = ({ focused, icon }: { focused: boolean; icon: any }) => {
  return (
    // Container must fill the available area or match item height to anchor to the top
    <View style={styles.tabIconWrapper}>
      {/* Conditionally render the active line indicator */}
      {focused && <View style={styles.activeTopLine} />}

      {!focused ? (
        <Image
          source={icon}
          style={[styles.icon, { tintColor: INACTIVE_COLOR }]}
          resizeMode="contain"
        />
      ) : (
        <Image
          source={icon}
          style={[styles.icon, { tintColor: ACTIVE_GRADIENT[1] }]}
          resizeMode="contain"
        />
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

const TabLayout = () => {
  const insets = useSafeAreaInsets();
  const bottomOffset = insets.bottom > 0 ? insets.bottom : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 70 + bottomOffset,
          backgroundColor: NAV_BG,
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          paddingBottom: bottomOffset,
        },
        tabBarItemStyle: {
          height: 70,
          justifyContent: "center",
          alignItems: "center",
        },
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
              tabBarLabel: isCenter ? () => null : tab.title,
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
  tabIconWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  activeTopLine: {
    position: "absolute",
    top: -6,                  // Pins the line exactly to the top border of the nav bar
    width: 32,               // Width of the indicator line (adjust as preferred)
    height: 2,               // Thickness of the line
    backgroundColor: ACTIVE_GRADIENT[1], // Solid accent color (or match your gradient start)
    borderBottomLeftRadius: 2,  // Optional rounding for a modern appearance
    borderBottomRightRadius: 2,
  },
  icon: {
    width: 24,
    height: 24,
  },
  label: {
    fontFamily: "Poppins",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 2,
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
