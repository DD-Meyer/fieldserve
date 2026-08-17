import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import ExpandableLeafletMap from "../ExpandableLeafletMap";
import type { LeafletMarker } from "../leafletHtml";
import RouteStopRow, { type RouteStop } from "../RouteStopRow";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import {
  useJobs,
  useRoadRoute,
  type Job,
  type RoutePoint,
} from "../../lib/hooks/useJobs";
import { useCurrentBusiness } from "../../lib/hooks/useBusiness";

const AVG_SPEED_KMH = 40;

function formatHours(min: number) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.round(Math.abs(min) % 60);
  const sign = min < 0 ? "-" : "";
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return toIsoDate(dt);
}

function humanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const today = toIsoDate(new Date());
  if (iso === today) return "Today";
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toStop(
  j: Job,
  order: number,
  distanceKm: number,
  travelMin: number,
): RouteStop {
  const d = new Date(j.scheduled_at);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    order,
    time,
    customer: j.customer_name || `Customer #${j.customer}`,
    location: j.address || j.customer_address || "—",
    durationMin: j.duration_minutes ?? 30,
    distanceKm,
    travelMin,
  };
}

function hasLatLng(j: Job): j is Job & { latitude: number; longitude: number } {
  return typeof j.latitude === "number" && typeof j.longitude === "number";
}

export default function ScheduleMobile() {
  const tabBarSpace = useTabBarSpace();

  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const today = toIsoDate(new Date());

  const { data, isLoading, error } = useJobs({
    date: selectedDate,
    ordering: "scheduled_at",
  });
  const business = useCurrentBusiness();

  const jobs = useMemo(() => data?.results ?? [], [data?.results]);
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status !== "cancelled"),
    [jobs],
  );
  const geoJobs = useMemo(() => activeJobs.filter(hasLatLng), [activeJobs]);

  const depot = useMemo(() => {
    const b = business.data;
    if (b && b.depot_latitude != null && b.depot_longitude != null) {
      return { latitude: b.depot_latitude, longitude: b.depot_longitude };
    }
    return null;
  }, [business.data]);

  const routePoints: RoutePoint[] = useMemo(() => {
    const points = geoJobs.map((job) => ({
      latitude: job.latitude,
      longitude: job.longitude,
    }));
    return depot ? [depot, ...points] : points;
  }, [depot, geoJobs]);
  const roadRoute = useRoadRoute(routePoints);

  const roadLegsByJob = useMemo(() => {
    const legs = new Map<number, { distance_km: number; duration_minutes: number }>();
    geoJobs.forEach((job, index) => {
      const legIndex = depot ? index : index - 1;
      const leg = roadRoute.data?.legs[legIndex];
      if (leg) legs.set(job.id, leg);
    });
    return legs;
  }, [depot, geoJobs, roadRoute.data?.legs]);

  const stops: RouteStop[] = useMemo(() => {
    let prevLat: number | null = depot?.latitude ?? null;
    let prevLng: number | null = depot?.longitude ?? null;
    return activeJobs.map((j, i) => {
      let km = 0;
      let travelMin = 0;
      const roadLeg = roadLegsByJob.get(j.id);
      const lat = typeof j.latitude === "number" ? j.latitude : null;
      const lng = typeof j.longitude === "number" ? j.longitude : null;
      if (roadLeg) {
        km = roadLeg.distance_km;
        travelMin = roadLeg.duration_minutes;
      } else if (prevLat != null && prevLng != null && lat != null && lng != null) {
        km = haversineKm(prevLat, prevLng, lat, lng);
        travelMin = Math.ceil((km / AVG_SPEED_KMH) * 60);
      }
      if (lat != null && lng != null) {
        prevLat = lat;
        prevLng = lng;
      }
      return toStop(j, i + 1, km, travelMin);
    });
  }, [activeJobs, depot, roadLegsByJob]);

  const totalDurationMin = stops.reduce((s, x) => s + x.durationMin, 0);
  const totalKm = roadRoute.data?.distance_km ?? stops.reduce((s, x) => s + x.distanceKm, 0);
  const totalTravelMin = roadRoute.data?.duration_minutes ?? stops.reduce((s, x) => s + (x.travelMin ?? 0), 0);

  const mapMarkers: LeafletMarker[] = useMemo(() => {
    const list: LeafletMarker[] = geoJobs.map((j) => ({
      latitude: j.latitude,
      longitude: j.longitude,
      order: activeJobs.findIndex((job) => job.id === j.id) + 1,
      label: j.customer_name || j.address || `Job #${j.id}`,
    }));
    if (depot) {
      list.unshift({
        latitude: depot.latitude,
        longitude: depot.longitude,
        order: 0,
        label: "Depot",
      });
    }
    return list;
  }, [activeJobs, geoJobs, depot]);

  const mapPath = roadRoute.data?.path ?? [];
  const googleMapsUrl = useMemo(() => buildGoogleMapsUrl(routePoints), [routePoints]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
      <Text className="text-xl font-bold text-slate-900">Today&apos;s Route</Text>
      <Text className="text-xs text-slate-500 mt-1 mb-4">
        Ordered by scheduled time. Travel follows the fastest available road route.
      </Text>

      <View className="flex-row items-center justify-between bg-white border border-slate-200 rounded-2xl px-3 py-2 mb-4">
        <Pressable
          onPress={() => setSelectedDate((d) => shiftDate(d, -1))}
          className="px-3 py-1"
          accessibilityLabel="Previous day"
        >
          <Text className="text-slate-600 text-lg">‹</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-sm font-semibold text-slate-900">{humanDate(selectedDate)}</Text>
          {selectedDate !== today ? (
            <Pressable onPress={() => setSelectedDate(today)}>
              <Text className="text-[11px] text-blue-600 mt-0.5">Jump to today</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
          className="px-3 py-1"
          accessibilityLabel="Next day"
        >
          <Text className="text-slate-600 text-lg">›</Text>
        </Pressable>
      </View>

      <View className="bg-white border border-slate-200 rounded-2xl p-4 flex-row">
        <View className="flex-1">
          <Text className="text-[11px] text-slate-500">Stops</Text>
          <Text className="text-slate-900 text-lg font-bold mt-0.5">
            {stops.length}
          </Text>
        </View>
        <View className="w-px bg-slate-200" />
        <View className="flex-1 pl-4">
          <Text className="text-[11px] text-slate-500">On-site</Text>
          <Text className="text-slate-900 text-lg font-bold mt-0.5">
            {formatHours(totalDurationMin)}
          </Text>
        </View>
        <View className="w-px bg-slate-200" />
        <View className="flex-1 pl-4">
          <Text className="text-[11px] text-slate-500">Travel</Text>
          <Text className="text-slate-900 text-lg font-bold mt-0.5">
            {formatHours(totalTravelMin)}
          </Text>
          <Text className="text-[11px] text-slate-400 mt-0.5">
            ~{totalKm.toFixed(1)} km
          </Text>
        </View>
      </View>

      {mapMarkers.length > 0 ? (
        <View className="mt-4">
          <ExpandableLeafletMap
            title={`${humanDate(selectedDate)} road route`}
            markers={mapMarkers}
            path={mapPath}
            height={240}
            googleMapsUrl={googleMapsUrl}
          />
          {roadRoute.isLoading ? (
            <Text className="text-[11px] text-slate-500 mt-2">Finding fastest road route…</Text>
          ) : roadRoute.error ? (
            <Text className="text-[11px] text-amber-700 mt-2">Road route unavailable. Travel figures are estimated.</Text>
          ) : null}
        </View>
      ) : null}

      <Text className="mt-5 mb-3 text-base font-semibold text-slate-900">
        Stops
      </Text>

      <View className="bg-white rounded-2xl border border-slate-200 p-4">
        {isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="text-xs text-red-600">Could not load route.</Text>
        ) : stops.length === 0 ? (
          <Text className="text-xs text-slate-500">
            No jobs on {humanDate(selectedDate)}. Create a booking to populate the route.
          </Text>
        ) : (
          stops.map((stop, i) => (
            <RouteStopRow
              key={stop.order}
              stop={stop}
              isLast={i === stops.length - 1}
            />
          ))
        )}
      </View>

      {stops.length > 0 && geoJobs.length < stops.length ? (
        <View className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex-row">
          <Text className="text-amber-700 text-sm mr-2">ⓘ</Text>
          <Text className="text-amber-800 text-xs leading-4 flex-1">
            Some jobs don&apos;t have a saved lat/lng, so travel estimates skip
            those legs. Geocode customer addresses to see the full route.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function buildGoogleMapsUrl(points: RoutePoint[]): string | null {
  if (points.length < 2) return null;
  const format = (point: RoutePoint) => `${point.latitude},${point.longitude}`;
  const origin = format(points[0]);
  const destination = format(points[points.length - 1]);
  const waypoints = points.slice(1, -1).map(format).join("|");
  return (
    "https://www.google.com/maps/dir/?api=1" +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "") +
    "&travelmode=driving"
  );
}
