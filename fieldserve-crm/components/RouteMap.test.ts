import { describe, expect, it } from "vitest";

import { buildGoogleMapsHtml } from "./routeMapHtml";
import { buildLeafletHtml } from "./leafletHtml";

describe("RouteMap guardrails", () => {
  it("uses the Google Maps JavaScript API without Directions API calls", () => {
    const previousKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaValidTestKey1234567890";

    try {
      const html = buildGoogleMapsHtml({
        markers: [{ latitude: 51.5074, longitude: -0.1278, order: 1, label: "A" }],
        path: [
          { latitude: 51.5074, longitude: -0.1278 },
          { latitude: 51.52, longitude: -0.1 },
        ],
        heatCells: [
          { latitude: 51.5074, longitude: -0.1278, intensity: 0.9 },
          { latitude: 51.52, longitude: -0.1, intensity: 0.4 },
        ],
        center: { latitude: 51.5074, longitude: -0.1278 },
        zoom: 12,
      });

      expect(html).toContain("maps.googleapis.com/maps/api/js");
      expect(html).not.toContain("directions.googleapis.com");
      expect(html).not.toContain("/maps/api/directions");
      expect(html).toContain("google.maps.Map");
      expect(html).toContain("google.maps.Polyline");
        expect(html).toContain("HeatOverlay");
        expect(html).toContain("fromLatLngToContainerPixel");
        expect(html).toContain("this.map.getDiv().appendChild(this.canvas)");
        expect(html).toContain("clusterHeat");
        expect(html).toContain("zoom_changed");
        expect(html).toContain("visibleClusters.length === 0");
        expect(html).toContain("var validHeat");
    } finally {
      if (previousKey === undefined) {
        delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      } else {
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = previousKey;
      }
    }
  });

  it("falls back to the Leaflet map when no Google Maps key is configured", () => {
    const previousKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    try {
      const html = buildLeafletHtml({
        markers: [{ latitude: 51.5074, longitude: -0.1278, order: 1 }],
        center: { latitude: 51.5074, longitude: -0.1278 },
        zoom: 12,
      });

      expect(html).toContain("leaflet.js");
      expect(html).not.toContain("maps.googleapis.com/maps/api/js");
    } finally {
      if (previousKey === undefined) {
        delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      } else {
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = previousKey;
      }
    }
  });

  it("ignores placeholder Google Maps keys and falls back to Leaflet instead of showing a blank map", () => {
    const previousKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "REPLACE_WITH_GOOGLE_MAPS_JS_KEY";

    try {
      const html = buildGoogleMapsHtml({
        markers: [{ latitude: 51.5074, longitude: -0.1278, order: 1 }],
        center: { latitude: 51.5074, longitude: -0.1278 },
        zoom: 12,
      });

      expect(html).toContain("leaflet.js");
      expect(html).not.toContain("maps.googleapis.com/maps/api/js");
    } finally {
      if (previousKey === undefined) {
        delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      } else {
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = previousKey;
      }
    }
  });
});
