import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import LeafletMap from "./LeafletMap";
import type { LeafletMapProps } from "./leafletHtml";

type Props = LeafletMapProps & {
  title: string;
  googleMapsUrl?: string | null;
};

export default function ExpandableLeafletMap({
  title,
  googleMapsUrl,
  height = 240,
  ...mapProps
}: Props) {
  const [open, setOpen] = useState(false);
  const window = useWindowDimensions();

  return (
    <>
      <View style={{ height, borderRadius: 8, overflow: "hidden", position: "relative" }}>
        <LeafletMap {...mapProps} height={height} interactive={false} />
        <Pressable
          onPress={() => setOpen(true)}
          style={{ position: "absolute", inset: 0 }}
          accessibilityLabel={`Open ${title} full screen`}
        >
          <View
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.94)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="expand-outline" size={20} color="#0f172a" />
          </View>
        </Pressable>
      </View>

      {googleMapsUrl ? (
        <Pressable
          onPress={() => Linking.openURL(googleMapsUrl)}
          style={{ marginTop: 10, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          accessibilityLabel="Open route in Google Maps"
        >
          <Ionicons name="navigate-outline" size={18} color="#1d4ed8" />
          <Text style={{ color: "#1d4ed8", fontSize: 13, fontWeight: "800" }}>Open in Google Maps</Text>
        </Pressable>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
          <View style={{ height: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }}>
            <Pressable onPress={() => setOpen(false)} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Close full map">
              <Ionicons name="close" size={25} color="#0f172a" />
            </Pressable>
            <Text style={{ flex: 1, color: "#0f172a", fontSize: 17, fontWeight: "800", textAlign: "center" }}>{title}</Text>
            <View style={{ width: 42 }} />
          </View>

          <LeafletMap
            {...mapProps}
            height={Math.max(300, window.height - (googleMapsUrl ? 132 : 58))}
            interactive
          />

          {googleMapsUrl ? (
            <View style={{ padding: 12, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e2e8f0" }}>
              <Pressable
                onPress={() => Linking.openURL(googleMapsUrl)}
                style={{ minHeight: 48, borderRadius: 8, backgroundColor: "#2563eb", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }}
                accessibilityLabel="Open route in Google Maps"
              >
                <Ionicons name="navigate" size={19} color="white" />
                <Text style={{ color: "white", fontSize: 14, fontWeight: "800" }}>Open directions in Google Maps</Text>
              </Pressable>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}