import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import { buildLeafletHtml, type LeafletMapProps } from "./leafletHtml";

export default function LeafletMap(props: LeafletMapProps) {
  const html = useMemo(() => buildLeafletHtml(props), [props]);
  const height = props.height ?? 260;

  return (
    <View style={{ height, width: "100%", overflow: "hidden", borderRadius: 16 }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ backgroundColor: "transparent" }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={props.interactive ?? false}
        androidLayerType="hardware"
      />
    </View>
  );
}
