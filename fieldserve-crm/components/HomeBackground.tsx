import React from 'react';
import { StyleSheet, View, ImageBackground } from 'react-native';

export default function HomeBackground() {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/images/Fieldserve-CRM Logo Banner.png')}
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
    marginBottom: -50, // padding below the banner
    zIndex: 0, // Ensure the banner is behind other content
  },
  banner: {
    width: '100%',
    height: '100%',
  },
});
