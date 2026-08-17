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
  label?: string;
  count?: number;
};

export type LeafletMapProps = {
  markers?: LeafletMarker[];
  path?: { latitude: number; longitude: number }[];
  heatCells?: LeafletHeatCell[];
  center?: { latitude: number; longitude: number };
  zoom?: number;
  height?: number;
  interactive?: boolean;
};

export function buildLeafletHtml(props: LeafletMapProps): string {
  const markers = props.markers ?? [];
  const path = props.path ?? [];
  const heat = props.heatCells ?? [];
  const center = props.center ?? { latitude: 51.5074, longitude: -0.1278 };
  const zoom = props.zoom ?? 12;
  const interactive = props.interactive ?? true;

  const payload = { markers, path, heat, center, zoom, interactive };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<style>
  html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#f1f5f9; }
  
  .stop-pin { 
    background:#2563eb; color:#fff; border-radius:9999px; width:26px; height:26px;
    display:flex; align-items:center; justify-content:center; font: 700 12px system-ui,sans-serif;
    border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;
  }
  .depot-pin { background:#0f172a; }

  .heat-badge {
    color:#fff; border-radius:9999px; width:26px; height:26px;
    display:flex; align-items:center; justify-content:center; font: 800 11px system-ui,sans-serif;
    border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.25); cursor:pointer;
  }
  
  .cluster-badge {
    width: 32px !important;
    height: 32px !important;
    font-size: 12px !important;
    border-width: 2.5px !important;
    box-shadow: 0 3px 8px rgba(0,0,0,0.3) !important;
  }

  .badge-high { background:#dc2626; }
  .badge-mid { background:#fb923c; }
  .badge-low { background:#22c55e; }

  .leaflet-popup-content-wrapper {
    border-radius: 12px;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .stat-popup { font-family: system-ui, sans-serif; padding: 4px 6px; }
  .stat-title { font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 2px; }
  .stat-value { font-size: 12px; color: #475569; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>
  var D = ${json};

  // Normalize heat cell points
  var heatCells = (D.heat || []).map(function(c, idx) {
    var lat = Number(c.latitude != null ? c.latitude : c.lat);
    var lng = Number(c.longitude != null ? c.longitude : c.lng);
    var intensity = Number(c.intensity != null ? c.intensity : (c.weight != null ? c.weight : c.value));
    
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return {
      index: idx + 1,
      latitude: lat,
      longitude: lng,
      intensity: isFinite(intensity) ? intensity : 0.5,
      label: c.label,
      count: c.count
    };
  }).filter(Boolean);

  var map = L.map('map', {
    zoomControl: D.interactive,
    attributionControl: false,
    dragging: D.interactive,
    touchZoom: D.interactive,
    scrollWheelZoom: D.interactive,
    doubleClickZoom: D.interactive,
    boxZoom: D.interactive,
    keyboard: D.interactive
  }).setView([D.center.latitude, D.center.longitude], D.zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  var bounds = [];

  // Smooth KDE Heatmap underlying layer
  if (heatCells.length > 0 && typeof L.heatLayer === 'function') {
    var rawPoints = heatCells.map(function(c) { return [c.latitude, c.longitude, c.intensity]; });
    L.heatLayer(rawPoints, {
      radius: 14,
      blur: 10,
      maxZoom: 16,
      minOpacity: 0.35,
      gradient: {
        0.2: '#4ade80',
        0.5: '#fbbf24',
        0.75: '#fb923c',
        1.0: '#dc2626'
      }
    }).addTo(map);
  }

  // Configure Marker Cluster Group
  var clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,           // Distance in pixels to cluster points
    spiderfyOnMaxZoom: true,        // Spiral out stacked markers at max zoom
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 16,     // Uncluster into individual pins when zoomed close
    iconCreateFunction: function(cluster) {
      var markers = cluster.getAllChildMarkers();
      var sumIntensity = 0;
      
      markers.forEach(function(m) {
        sumIntensity += (m.options.intensity || 0.5);
      });
      
      var avg = sumIntensity / markers.length;
      var badgeClass = avg >= 0.7 ? 'badge-high' : (avg >= 0.4 ? 'badge-mid' : 'badge-low');
      
      return L.divIcon({
        html: '<div class="heat-badge cluster-badge ' + badgeClass + '">' + cluster.getChildCount() + '</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
    }
  });

  // Populate cluster layers
  heatCells.forEach(function(c) {
    var badgeClass = c.intensity >= 0.75 ? 'badge-high' : (c.intensity >= 0.4 ? 'badge-mid' : 'badge-low');
    var html = '<div class="heat-badge ' + badgeClass + '">' + c.index + '</div>';
    var icon = L.divIcon({ className: '', html: html, iconSize: [26, 26], iconAnchor: [13, 13] });
    
    var mk = L.marker([c.latitude, c.longitude], { 
      icon: icon,
      intensity: c.intensity 
    });
    
    var title = c.label || ('Demand Zone #' + c.index);
    var countText = c.count ? (c.count + ' bookings · ') : '';
    var intensityPct = Math.round(c.intensity * 100) + '% density';
    
    var popupContent = 
      '<div class="stat-popup">' +
        '<div class="stat-title">' + title + '</div>' +
        '<div class="stat-value">' + countText + intensityPct + '</div>' +
      '</div>';
      
    mk.bindPopup(popupContent, { offset: [0, -10] });
    clusterGroup.addLayer(mk);
    bounds.push([c.latitude, c.longitude]);
  });

  map.addLayer(clusterGroup);

  // Render routes if present
  if (D.path && D.path.length > 1) {
    var latlngs = D.path.map(function(p){ return [p.latitude, p.longitude]; });
    L.polyline(latlngs, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);
    latlngs.forEach(function(ll){ bounds.push(ll); });
  }

  // Render route stop markers if present
  (D.markers || []).forEach(function(m){
    var isDepot = m.order === 0;
    var html = '<div class="stop-pin' + (isDepot ? ' depot-pin' : '') + '">' +
      (isDepot ? 'D' : (m.order != null ? m.order : '·')) + '</div>';
    var icon = L.divIcon({ className: '', html: html, iconSize: [26, 26], iconAnchor: [13, 13] });
    var mk = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
    if (m.label) mk.bindTooltip(m.label, { direction: 'top', offset: [0, -10] });
    bounds.push([m.latitude, m.longitude]);
  });

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 13);
  }

  setTimeout(function() {
    map.invalidateSize();
  }, 150);
</script>
</body>
</html>`;
}