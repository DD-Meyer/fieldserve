import { Image, Text, View } from "react-native";

import RiskBadge, { levelFromProb, type RiskLevel } from "./RiskBadge";

const AVATAR = require("../assets/images/avatar.png");

export type ChurnCustomer = {
  id: string | number;
  name: string;
  lastVisit: string;
  probability: number;
  recencyDays: number;
  frequency: number;
  monetary: number;
  level?: RiskLevel;
  scored?: boolean;
};

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-[11px] text-slate-500">{label}</Text>
      <Text className="text-sm font-semibold text-slate-900 mt-0.5">{value}</Text>
    </View>
  );
}

function NoScoreBadge() {
  return (
    <View className="px-2.5 py-1 rounded-full items-center bg-slate-100">
      <Text className="text-[11px] font-bold text-slate-500">—</Text>
      <Text className="text-[10px] font-medium text-slate-500">No score</Text>
    </View>
  );
}

export default function CustomerChurnCard({ customer }: { customer: ChurnCustomer }) {
  const scored = customer.scored !== false;
  const level = customer.level ?? levelFromProb(customer.probability);

  return (
    <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
      <View className="flex-row items-center">
        <Image
          source={AVATAR}
          style={{ width: 44, height: 44, borderRadius: 22 }}
        />
        <View className="flex-1 pl-3">
          <Text className="text-base font-semibold text-slate-900">
            {customer.name}
          </Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {scored ? `Last visit · ${customer.lastVisit}` : "No bookings yet"}
          </Text>
        </View>
        {scored ? (
          <RiskBadge level={level} probability={customer.probability} />
        ) : (
          <NoScoreBadge />
        )}
      </View>

      {scored ? (
        <View className="mt-4 flex-row pt-3 border-t border-slate-100">
          <StatBlock label="Recency" value={`${customer.recencyDays}d`} />
          <View className="w-px bg-slate-100" />
          <StatBlock label="Frequency" value={`${customer.frequency}`} />
          <View className="w-px bg-slate-100" />
          <StatBlock
            label="Monetary"
            value={`$${customer.monetary.toLocaleString()}`}
          />
        </View>
      ) : (
        <View className="mt-3 pt-3 border-t border-slate-100">
          <Text className="text-[11px] text-slate-500">
            We'll score this customer the moment they have their first booking.
          </Text>
        </View>
      )}
    </View>
  );
}
