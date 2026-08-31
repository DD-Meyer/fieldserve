import React from 'react';
import { StyleSheet, View, ImageBackground } from 'react-native';

export default function HomeBackground() {
  return (
    <View style={styles.container}>
      {/* Fullscreen gradient image of vehicle background */}
      <ImageBackground
        source={require('../assets/images/Fieldserve-CRM Logo Banner.png')} // Replace with your image path
        style={styles.banner}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 180, // Adjust this value to control how tall the banner is
    marginBottom: 0, // padding below the banner
    zIndex: -10, // Ensure the banner is behind other content
  },
  banner: {
    width: '100%',
    height: '100%',
  },
});
