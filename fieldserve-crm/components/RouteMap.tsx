import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import { buildLeafletHtml, type LeafletMapProps } from "./leafletHtml";
import { buildGoogleMapsHtml } from "./routeMapHtml";

export type RouteMapProps = LeafletMapProps;

export default function RouteMap(props: RouteMapProps) {
  const html = useMemo(() => {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    return key ? buildGoogleMapsHtml(props) : buildLeafletHtml(props);
  }, [props]);

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

export { buildGoogleMapsHtml, buildLeafletHtml } from "./routeMapHtml";
