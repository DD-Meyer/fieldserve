import { Text, View } from "react-native";

export type UpcomingJob = {
  id: string | number;
  time: string;
  customer: string;
  service: string;
  location: string;
};

export default function UpcomingJobRow({ job }: { job: UpcomingJob }) {
  return (
    <View className="flex-row items-start px-4 py-3 border-b border-slate-100">
      <View className="w-16 pr-2">
        <Text className="text-sm font-semibold text-blue-600">{job.time}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{job.customer}</Text>
        <Text className="text-xs text-slate-600 mt-0.5">{job.service}</Text>
        <Text className="text-xs text-slate-400 mt-0.5">{job.location}</Text>
      </View>
    </View>
  );
}
