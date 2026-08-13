import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import LeafletMap from "../LeafletMap";
import type { LeafletMarker } from "../leafletHtml";
import RouteStopRow, { type RouteStop } from "../RouteStopRow";
import SegmentedToggle from "../SegmentedToggle";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { useJobs, type Job } from "../../lib/hooks/useJobs";
import {
  useOptimiseSchedule,
  type ScheduleResponse,
} from "../../lib/hooks/usePredictions";

const OPTIONS = [
  { key: "optimized", label: "Optimized" },
  { key: "manual", label: "Manual" },
];

function formatHours(min: number) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.round(Math.abs(min) % 60);
  const sign = min < 0 ? "-" : "";
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
}

function toStop(j: Job, order: number, distanceKm = 0): RouteStop {
  const d = new Date(j.scheduled_at);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    order,
    time,
    customer: j.customer_name || `Customer #${j.customer}`,
    location: j.address || j.customer_address || "—",
    durationMin: j.duration_minutes ?? 30,
    distanceKm,
  };
}

function hasLatLng(j: Job): j is Job & { latitude: number; longitude: number } {
  return typeof j.latitude === "number" && typeof j.longitude === "number";
}

export default function ScheduleMobile() {
  const [mode, setMode] = useState("optimized");
  const tabBarSpace = useTabBarSpace();

  const { data, isLoading, error } = useJobs({
    ordering: "scheduled_at",
  });

  const jobs = data?.results ?? [];
  const upcoming = useMemo(() => {
    const now = Date.now();
    return jobs.filter(
      (j) =>
        j.status !== "completed" &&
        j.status !== "cancelled" &&
        new Date(j.scheduled_at).getTime() >= now - 6 * 60 * 60 * 1000,
    );
  }, [jobs]);
  const geoJobs = useMemo(() => upcoming.filter(hasLatLng), [upcoming]);
  const geoKey = geoJobs.map((j) => j.id).join(",");

  const optimise = useOptimiseSchedule();
  const [route, setRoute] = useState<ScheduleResponse | null>(null);

  useEffect(() => {
    if (mode !== "optimized" || geoJobs.length < 2) {
      setRoute(null);
      return;
    }
    // Depot = centroid of today's jobs until Business gains a depot field.
    const lat = geoJobs.reduce((s, j) => s + j.latitude, 0) / geoJobs.length;
    const lng = geoJobs.reduce((s, j) => s + j.longitude, 0) / geoJobs.length;
    optimise
      .mutateAsync({
        depot: { latitude: lat, longitude: lng },
        job_ids: geoJobs.map((j) => j.id),
        average_speed_kmh: 40,
      })
      .then(setRoute)
      .catch(() => setRoute(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, geoKey]);

  const stops: RouteStop[] = useMemo(() => {
    if (route && route.stops.length > 0) {
      const byId = new Map(upcoming.map((j) => [j.id, j]));
      return route.stops
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => {
          const j = byId.get(s.job_id);
          if (!j) return null;
          return toStop(j, s.order, s.distance_km);
        })
        .filter(Boolean) as RouteStop[];
    }
    return upcoming.map((j, i) => toStop(j, i + 1));
  }, [route, upcoming]);

  const totalDurationMin = stops.reduce((s, x) => s + x.durationMin, 0);
  const totalKm = route?.total_distance_km ?? stops.length * 4.2;
  const travelMin = route?.total_travel_minutes ?? 0;
  const savedMin = route ? Math.max(0, stops.length * 8 - travelMin) : 0;

  const depot = useMemo(() => {
    if (geoJobs.length === 0) return null;
    return {
      latitude: geoJobs.reduce((s, j) => s + j.latitude, 0) / geoJobs.length,
      longitude: geoJobs.reduce((s, j) => s + j.longitude, 0) / geoJobs.length,
    };
  }, [geoJobs]);

  const mapMarkers: LeafletMarker[] = useMemo(() => {
    const jobsById = new Map(geoJobs.map((j) => [j.id, j]));
    const ordered =
      route && route.stops.length > 0
        ? route.stops
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => {
              const j = jobsById.get(s.job_id);
              return j
                ? {
                    latitude: j.latitude,
                    longitude: j.longitude,
                    order: s.order,
                    label:
                      j.customer_name || j.address || `Job #${j.id}`,
                  }
                : null;
            })
            .filter(Boolean)
        : geoJobs.map((j, i) => ({
            latitude: j.latitude,
            longitude: j.longitude,
            order: i + 1,
            label: j.customer_name || j.address || `Job #${j.id}`,
          }));
    const list = (ordered as LeafletMarker[]).slice();
    if (depot) {
      list.unshift({
        latitude: depot.latitude,
        longitude: depot.longitude,
        order: 0,
        label: "Depot",
      });
    }
    return list;
  }, [route, geoJobs, depot]);

  const mapPath = useMemo(() => {
    if (mapMarkers.length < 2) return [];
    return mapMarkers.map((m) => ({
      latitude: m.latitude,
      longitude: m.longitude,
    }));
  }, [mapMarkers]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace }}>
      <Text className="text-xl font-bold text-slate-900">
        Smart Schedule Optimizer
      </Text>
      <Text className="text-xs text-slate-500 mt-1 mb-4">
        Upcoming route ordered by the ML nearest-neighbour scheduler.
      </Text>

      <View className="bg-blue-600 rounded-2xl p-5">
        <Text className="text-blue-100 text-xs">Estimated time saved</Text>
        <Text className="text-white text-3xl font-bold mt-1">
          {formatHours(savedMin)}
        </Text>
        <View className="flex-row mt-4 pt-4 border-t border-blue-500">
          <View className="flex-1">
            <Text className="text-blue-100 text-[11px]">On-site time</Text>
            <Text className="text-white text-sm font-semibold mt-0.5">
              {formatHours(totalDurationMin)}
            </Text>
          </View>
          <View className="w-px bg-blue-500" />
          <View className="flex-1 pl-4">
            <Text className="text-blue-100 text-[11px]">Total stops</Text>
            <Text className="text-white text-sm font-semibold mt-0.5">
              {stops.length}
            </Text>
            <Text className="text-blue-200 text-[11px] mt-0.5">
              ~{totalKm.toFixed(1)} km
              {route ? ` • ${formatHours(travelMin)} travel` : ""}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-5">
        <SegmentedToggle options={OPTIONS} active={mode} onChange={setMode} />
      </View>

      <Text className="mt-5 mb-3 text-base font-semibold text-slate-900">
        Upcoming Route
      </Text>

      {mapMarkers.length > 0 ? (
        <View className="mb-3">
          <LeafletMap markers={mapMarkers} path={mapPath} height={240} />
        </View>
      ) : null}

      <View className="bg-white rounded-2xl border border-slate-200 p-4">
        {isLoading || optimise.isPending ? (
          <View className="py-6 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="text-xs text-red-600">Could not load route.</Text>
        ) : stops.length === 0 ? (
          <Text className="text-xs text-slate-500">
            No upcoming jobs. Create a booking to populate the route.
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

      {mode === "optimized" && geoJobs.length < 2 ? (
        <View className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex-row">
          <Text className="text-amber-700 text-sm mr-2">ⓘ</Text>
          <Text className="text-amber-800 text-xs leading-4 flex-1">
            Route optimisation needs at least two upcoming jobs with a saved
            location. Add lat/lng to jobs to see the ML nearest-neighbour plan.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
