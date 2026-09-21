import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import type { BreakdownItem, ChartPoint } from "@/lib/liveInsightsSummary";

const DEFAULT_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

function maxValue(values: number[]): number {
  return Math.max(1, ...values.map((value) => Math.max(0, value)));
}

export function InsightLineChart({
  points,
  color = "#2563eb",
}: {
  points: ChartPoint[];
  color?: string;
}) {
  const width = 300;
  const height = 116;
  const padding = 14;
  const max = maxValue(points.map((point) => point.value));
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const coords = points.map((point, index) => {
    const x = padding + (points.length <= 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
    const y = padding + usableHeight - (Math.max(0, point.value) / max) * usableHeight;
    return { x, y, point };
  });
  const linePoints = coords.map((coord) => `${coord.x},${coord.y}`).join(" ");

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth={1} />
        <Polyline points={linePoints} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((coord) => (
          <Circle key={`${coord.point.label}-${coord.x}`} cx={coord.x} cy={coord.y} r={4} fill="#ffffff" stroke={color} strokeWidth={2} />
        ))}
      </Svg>
      <View className="flex-row justify-between mt-1">
        {points.map((point) => (
          <Text key={point.label} className="text-[10px] text-slate-500" numberOfLines={1}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function SegmentedBreakdown({ items }: { items: BreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <View>
      <View className="h-3 flex-row overflow-hidden rounded-full bg-slate-100">
        {total > 0 ? items.map((item, index) => (
          <View
            key={item.label}
            style={{ flex: item.value, backgroundColor: item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length] }}
          />
        )) : <View style={{ flex: 1, backgroundColor: "#e2e8f0" }} />}
      </View>
      <View className="mt-3 gap-2">
        {items.map((item, index) => (
          <View key={item.label} className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-3">
              <View
                className="h-2.5 w-2.5 rounded-full mr-2"
                style={{ backgroundColor: item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length] }}
              />
              <Text className="text-xs text-slate-600 capitalize" numberOfLines={1}>{item.label}</Text>
            </View>
            <Text className="text-xs font-semibold text-slate-900">{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function HorizontalBars({ items }: { items: BreakdownItem[] }) {
  const max = maxValue(items.map((item) => item.value));
  return (
    <View className="gap-3">
      {items.length ? items.map((item, index) => (
        <View key={item.label}>
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs font-semibold text-slate-700 capitalize flex-1 pr-3" numberOfLines={1}>{item.label}</Text>
            <Text className="text-xs text-slate-500">{item.value.toLocaleString()}</Text>
          </View>
          <View className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%`, backgroundColor: item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length] }}
            />
          </View>
        </View>
      )) : (
        <Text className="text-xs text-slate-500">No chart data yet.</Text>
      )}
    </View>
  );
}

export function ComparisonBars({
  firstLabel,
  firstValue,
  secondLabel,
  secondValue,
}: {
  firstLabel: string;
  firstValue: number;
  secondLabel: string;
  secondValue: number;
}) {
  const max = maxValue([firstValue, secondValue]);
  return (
    <View className="gap-3">
      <HorizontalBars
        items={[
          { label: firstLabel, value: firstValue, color: "#64748b" },
          { label: secondLabel, value: secondValue, color: "#16a34a" },
        ].map((item) => ({ ...item, value: Math.round(item.value) }))}
      />
      <Text className="text-[10px] text-slate-400">Scale max: {Math.round(max)} min</Text>
    </View>
  );
}
