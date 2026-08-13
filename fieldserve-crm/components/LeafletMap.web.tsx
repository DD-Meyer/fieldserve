import { useMemo } from "react";

import { buildLeafletHtml, type LeafletMapProps } from "./leafletHtml";

export default function LeafletMap(props: LeafletMapProps) {
  const html = useMemo(() => buildLeafletHtml(props), [props]);
  const height = props.height ?? 260;

  return (
    <iframe
      title="map"
      srcDoc={html}
      style={{
        width: "100%",
        height,
        border: 0,
        borderRadius: 16,
        overflow: "hidden",
      }}
    />
  );
}
