export type LeafletMarker = {
  latitude: number;
  longitude: number;
  label?: string;
  order?: number;
  color?: string;
};

export type LeafletHeatCell = {
  latitude: number;
  longitude: number;
  intensity: number;
};

export type LeafletMapProps = {
  markers?: LeafletMarker[];
  path?: { latitude: number; longitude: number }[];
  heatCells?: LeafletHeatCell[];
  center?: { latitude: number; longitude: number };
  zoom?: number;
  height?: number;
};

function intensityColor(i: number): string {
  if (i >= 0.75) return "#dc2626";
  if (i >= 0.5) return "#fb923c";
  if (i >= 0.25) return "#fbbf24";
  return "#86efac";
}

export function buildLeafletHtml(props: LeafletMapProps): string {
  const markers = props.markers ?? [];
  const path = props.path ?? [];
  const heat = props.heatCells ?? [];
  const center = props.center ?? { latitude: 51.5074, longitude: -0.1278 };
  const zoom = props.zoom ?? 12;

  const payload = { markers, path, heat, center, zoom };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const colorFn = intensityColor.toString();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#f1f5f9; }
  .stop-pin { background:#2563eb; color:#fff; border-radius:9999px; width:26px; height:26px;
    display:flex; align-items:center; justify-content:center; font: 700 12px system-ui,sans-serif;
    border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.25); }
  .depot-pin { background:#0f172a; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var D = ${json};
  var intensityColor = ${colorFn};
  var map = L.map('map', { zoomControl:false, attributionControl:false })
    .setView([D.center.latitude, D.center.longitude], D.zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  var bounds = [];

  D.heat.forEach(function(c){
    var r = 8 + c.intensity * 22;
    L.circleMarker([c.latitude, c.longitude], {
      radius: r,
      color: intensityColor(c.intensity),
      fillColor: intensityColor(c.intensity),
      fillOpacity: 0.45,
      weight: 0
    }).addTo(map);
    bounds.push([c.latitude, c.longitude]);
  });

  if (D.path.length > 1) {
    var latlngs = D.path.map(function(p){ return [p.latitude, p.longitude]; });
    L.polyline(latlngs, { color:'#2563eb', weight:4, opacity:0.85 }).addTo(map);
    latlngs.forEach(function(ll){ bounds.push(ll); });
  }

  D.markers.forEach(function(m){
    var isDepot = m.order === 0;
    var html = '<div class="stop-pin' + (isDepot ? ' depot-pin' : '') + '">' +
      (isDepot ? 'D' : (m.order != null ? m.order : '·')) + '</div>';
    var icon = L.divIcon({ className:'', html: html, iconSize:[26,26], iconAnchor:[13,13] });
    var mk = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
    if (m.label) mk.bindTooltip(m.label, { direction:'top', offset:[0,-10] });
    bounds.push([m.latitude, m.longitude]);
  });

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding:[24,24], maxZoom: 15 });
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 13);
  }
</script>
</body>
</html>`;
}
