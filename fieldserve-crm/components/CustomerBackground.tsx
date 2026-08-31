// custom animated background for the customers page
import React from "react";
import { StyleSheet, View, ImageBackground } from "react-native";
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
export default function CustomerBackground() {
  return (
    <View style={styles.container}>
      {/* Fullscreen gradient image of vehicle background */}
      <ImageBackground
        source={require("../assets/images/Fieldserve-CRM Logo Banner.png")} // Replace with your image path
        style={styles.banner}
        resizeMode="cover"
      />
    </View>
  );
}