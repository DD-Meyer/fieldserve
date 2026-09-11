import { buildLeafletHtml, type LeafletMapProps } from "./leafletHtml";

export type RouteMapProps = LeafletMapProps;

export function buildGoogleMapsHtml(props: RouteMapProps): string {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const isPlaceholder = !!apiKey && /(replace[_ -]?with|placeholder|example|your_.*key|your-google|your_.*maps)/i.test(apiKey);
  if (!apiKey || isPlaceholder) {
    return buildLeafletHtml(props);
  }

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
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f1f5f9; }
    body { font-family: system-ui, sans-serif; }
    .gm-style .gm-style-iw-c { border-radius: 12px; }
    .map-label { font-size: 12px; font-weight: 700; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.35); }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var D = ${json};

  function initMap() {
    var map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: Number(D.center.latitude), lng: Number(D.center.longitude) },
      zoom: Number(D.zoom),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: D.interactive,
      scrollwheel: D.interactive,
      draggable: D.interactive,
      disableDoubleClickZoom: !D.interactive,
      keyboardShortcuts: D.interactive,
      clickableIcons: false,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
    });

    var bounds = new google.maps.LatLngBounds();

    var validHeat = (D.heat || []).map(function(cell) {
      var latitude = Number(cell.latitude);
      var longitude = Number(cell.longitude);
      var intensity = Number(cell.intensity);
      if (!isFinite(latitude) || !isFinite(longitude)) return null;
      return { latitude: latitude, longitude: longitude, intensity: isFinite(intensity) ? intensity : 0.1 };
    }).filter(Boolean);

    function clusterHeat(cells, projection, zoom) {
      var distance = zoom <= 11 ? 58 : (zoom <= 13 ? 34 : 16);
      var buckets = {};
      cells.forEach(function(cell) {
        var point = projection.fromLatLngToContainerPixel(new google.maps.LatLng(cell.latitude, cell.longitude));
        var key = Math.floor(point.x / distance) + ':' + Math.floor(point.y / distance);
        if (!buckets[key]) buckets[key] = { latitude: 0, longitude: 0, intensity: 0, count: 0 };
        buckets[key].latitude += cell.latitude;
        buckets[key].longitude += cell.longitude;
        buckets[key].intensity += cell.intensity;
        buckets[key].count += 1;
      });
      return Object.keys(buckets).map(function(key) {
        var bucket = buckets[key];
        return {
          latitude: bucket.latitude / bucket.count,
          longitude: bucket.longitude / bucket.count,
          intensity: bucket.intensity / bucket.count,
          count: bucket.count,
        };
      });
    }

    function HeatOverlay(mapInstance, cells) {
      this.map = mapInstance;
      this.cells = cells;
      this.canvas = null;
      this.setMap(mapInstance);
    }

    HeatOverlay.prototype = new google.maps.OverlayView();
    HeatOverlay.prototype.onAdd = function() {
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.left = '0';
      this.canvas.style.top = '0';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '0';
      this.map.getDiv().appendChild(this.canvas);
    };
    HeatOverlay.prototype.draw = function() {
      if (!this.canvas) return;
      var projection = this.getProjection();
      var div = this.map.getDiv();
      var width = div.clientWidth;
      var height = div.clientHeight;
      var scale = window.devicePixelRatio || 1;
      this.canvas.width = width * scale;
      this.canvas.height = height * scale;
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
      var context = this.canvas.getContext('2d');
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);

      clusterHeat(this.cells, projection, this.map.getZoom()).forEach(function(cell) {
        var point = projection.fromLatLngToContainerPixel(new google.maps.LatLng(cell.latitude, cell.longitude));
        var intensity = Math.max(0.1, Math.min(1, Number(cell.intensity) || 0.1));
        var radius = 12 + intensity * 20;
        var gradient = context.createRadialGradient(point.x, point.y, 2, point.x, point.y, radius);
        gradient.addColorStop(0, intensity >= 0.8 ? 'rgba(220,38,38,0.34)' : 'rgba(249,115,22,0.28)');
        gradient.addColorStop(0.45, intensity >= 0.5 ? 'rgba(249,115,22,0.2)' : 'rgba(250,204,21,0.18)');
        gradient.addColorStop(1, 'rgba(34,197,94,0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
      });
    };
    HeatOverlay.prototype.onRemove = function() {
      if (this.canvas) this.canvas.remove();
      this.canvas = null;
    };

    if (validHeat.length > 0) new HeatOverlay(map, validHeat);

    var hotspotInfo = new google.maps.InfoWindow();
    var hotspotMarkers = [];
    function renderHotspots() {
      hotspotMarkers.forEach(function(marker) { marker.setMap(null); });
      hotspotMarkers = [];
      var projectionOverlay = new google.maps.OverlayView();
      projectionOverlay.onAdd = function() {};
      projectionOverlay.draw = function() {};
      projectionOverlay.onRemove = function() {};
      projectionOverlay.setMap(map);
      var projection = projectionOverlay.getProjection();
      if (!projection) return;
      var clusters = clusterHeat(validHeat, projection, map.getZoom());
      var visibleClusters = clusters.filter(function(cell) { return cell.intensity >= 0.6; });
      if (visibleClusters.length === 0 && clusters.length > 0) {
        visibleClusters = [clusters.reduce(function(strongest, cell) {
          return cell.intensity > strongest.intensity ? cell : strongest;
        }, clusters[0])];
      }
      visibleClusters.forEach(function(cell, index) {
      var intensity = Number(cell.intensity) || 0;
      var hotspot = new google.maps.Marker({
        position: { lat: Number(cell.latitude), lng: Number(cell.longitude) },
        map: map,
        label: { text: String(index + 1), color: '#fff', fontSize: '11px', fontWeight: '700' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: intensity >= 0.8 ? '#dc2626' : '#f97316',
          fillOpacity: 0.95,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: cell.count > 1 ? 'Demand cluster (' + cell.count + ' cells)' : 'Demand hotspot ' + (index + 1),
      });
      hotspotMarkers.push(hotspot);
      hotspot.addListener('click', function() {
        hotspotInfo.setContent(
          '<div style="font: 12px system-ui,sans-serif; padding: 4px 6px;">' +
          '<strong>Business opportunity</strong><br />' +
          Math.round(intensity * 100) + '% predicted demand density. Test a local service run or promotion here.' +
          '</div>'
        );
        hotspotInfo.open({ map: map, anchor: hotspot });
      });
      });
      projectionOverlay.setMap(null);
    }
    google.maps.event.addListenerOnce(map, 'idle', renderHotspots);
    map.addListener('zoom_changed', renderHotspots);

    (D.path || []).forEach(function(point) {
      bounds.extend({ lat: Number(point.latitude), lng: Number(point.longitude) });
    });

    (D.markers || []).forEach(function(marker) {
      bounds.extend({ lat: Number(marker.latitude), lng: Number(marker.longitude) });
    });

    var routePath = (D.path || []).map(function(point) {
      return { lat: Number(point.latitude), lng: Number(point.longitude) };
    });

    if (routePath.length > 1) {
      new google.maps.Polyline({
        path: routePath,
        geodesic: false,
        strokeColor: '#2563eb',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map: map,
      });
    }

    (D.markers || []).forEach(function(marker) {
      var labelText = marker.order === 0 ? 'D' : (marker.order != null ? String(marker.order) : '•');
      var fillColor = marker.order === 0 ? '#0f172a' : '#2563eb';
      new google.maps.Marker({
        position: { lat: Number(marker.latitude), lng: Number(marker.longitude) },
        map: map,
        label: {
          text: labelText,
          color: '#fff',
          fontSize: '12px',
          fontWeight: '700',
          className: 'map-label',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 15,
          fillColor: fillColor,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: marker.label || 'Route stop',
      });
    });

    if (bounds.isEmpty()) {
      map.setCenter({ lat: Number(D.center.latitude), lng: Number(D.center.longitude) });
      map.setZoom(Number(D.zoom));
    } else {
      map.fitBounds(bounds, 24);
    }
  }
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=visualization&callback=initMap"></script>
</body>
</html>`;
}
