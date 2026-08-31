import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
// Import the SearchField component we created previously
import SearchField from "@/components/SearchField"; 
import { useJobs } from "@/lib/hooks/useJobs";

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string }>();
  const routeQuery = typeof params.query === "string" ? params.query : "";
  const [query, setQuery] = useState("");
  const { data: jobsPage } = useJobs({ ordering: "-scheduled_at" });
  const jobs = jobsPage?.results ?? [];

  useEffect(() => {
    setQuery(routeQuery);
  }, [routeQuery]);

  // Filter the results dynamically based on the search query
  const filteredResults = useMemo(() => {
    if (!query.trim()) return jobs;

    const lowerCaseQuery = query.toLowerCase();
    return jobs.filter(
      (item) =>
        item.customer_name.toLowerCase().includes(lowerCaseQuery) ||
        item.service_type.toLowerCase().includes(lowerCaseQuery)
    );
  }, [jobs, query]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Closing the search routes the user back to the previous screen. */}
      <SearchField 
        onClose={() => router.back()} 
        onSearch={(text) => setQuery(text)}
        initialQuery={routeQuery}
      />

      <View className="flex-1 p-4">
        <Text className="text-lg font-semibold mb-4">
          {query ? `Results for "${query}"` : "Recent Bookings"}
        </Text>
        
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          // What to show if the search yields no results
          ListEmptyComponent={() => (
            <View className="py-10 items-center">
              <Text className="text-gray-500">No results found.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/job/${item.id}`)}
              className="p-4 mb-3 bg-white rounded-xl border border-gray-100 shadow-sm"
            >
              <Text className="text-base font-semibold text-gray-900">
                {item.customer_name}
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                {item.service_type}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}