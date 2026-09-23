import { Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { colors, typography } from "@/constants/theme";
import { money, type RevenuePoint } from "./dashboardData";

type Props = {
  points: RevenuePoint[];
  previousTotal: number;
};

const WIDTH = 320;
const HEIGHT = 92;
const PADDING_X = 2;
const PADDING_Y = 10;

export default function WeeklyRevenueCard({ points, previousTotal }: Props) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const max = Math.max(1, ...points.map((point) => point.value));
  const chartWidth = WIDTH - PADDING_X * 2;
  const chartHeight = HEIGHT - PADDING_Y * 2;
  const coordinates = points.map((point, index) => ({
    x: PADDING_X + (index / Math.max(1, points.length - 1)) * chartWidth,
    y: PADDING_Y + chartHeight - (point.value / max) * chartHeight,
  }));
  const line = coordinates.map(({ x, y }) => `${x} ${y}`).join(" L ");
  const change = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;

  return (
    <View
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
      className="border rounded-2xl px-4 pt-4 pb-3 shadow-sm"
    >
      <View className="flex-row justify-between items-start">
        <View>
          <Text style={typography.styles.sectionTitle}>Weekly Revenue</Text>
          <Text style={typography.styles.caption}>Mon - Sun</Text>
        </View>
        <View className="items-end">
          <Text style={typography.styles.metricValue}>{money(total)}</Text>
          <Text style={typography.styles.metricDelta}>
            {change === null ? "This week" : `${change >= 0 ? "+" : ""}${change}% this week`}
          </Text>
        </View>
      </View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <Line key={ratio} x1={0} x2={WIDTH} y1={HEIGHT * ratio} y2={HEIGHT * ratio} stroke="#E8EDF5" strokeWidth={1} />
        ))}
        <Path d={`M ${line}`} fill="none" stroke={colors.accent} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View className="flex-row justify-between px-1">
        {points.map((point, index) => <Text key={`${point.label}-${index}`} style={typography.styles.calendarWeekday}>{point.label}</Text>)}
      </View>
    </View>
  );
}