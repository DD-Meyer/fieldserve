import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import { buildLeafletHtml, type LeafletMapProps } from "./leafletHtml";
import { buildGoogleMapsHtml } from "./routeMapHtml";

export type RouteMapProps = LeafletMapProps & {
  onMarkerPress?: (jobId: number) => void;
};

export default function RouteMap(props: RouteMapProps) {
  const { onMarkerPress, ...mapProps } = props;
  const html = useMemo(() => {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    return key ? buildGoogleMapsHtml(mapProps) : buildLeafletHtml(mapProps);
  }, [mapProps]);

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
        onError={(event) => {
          if (__DEV__) console.warn("[RouteMap] WebView error", event.nativeEvent);
        }}
        onHttpError={(event) => {
          if (__DEV__) console.warn("[RouteMap] WebView HTTP error", event.nativeEvent);
        }}
        onMessage={(event) => {
          if (!onMarkerPress) return;
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === "job-marker-press" && Number.isFinite(message.jobId)) {
              onMarkerPress(Number(message.jobId));
            }
          } catch {
            // Ignore non-interaction messages from the map document.
          }
        }}
      />
    </View>
  );
}

export { buildGoogleMapsHtml } from "./routeMapHtml";
export { buildLeafletHtml } from "./leafletHtml";
