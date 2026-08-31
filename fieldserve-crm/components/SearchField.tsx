import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";

type Props = {
  onClose: () => void;
  onSearch: (query: string) => void;
  initialQuery?: string;
};

export default function SearchField({ onClose, onSearch, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  const handleSubmit = () => {
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <View className="h-14 flex-row items-center bg-white px-4 shadow-sm w-full">
      {/* Back Button to close search */}
      <Pressable onPress={onClose} hitSlop={12} className="mr-3">
        <Text className="text-lg font-semibold text-slate-700">{"<"}</Text>
      </Pressable>

      {/* Input Container */}
      <View className="flex-1 flex-row items-center rounded-full bg-gray-100 px-3 h-10">
        <Pressable onPress={handleSubmit} hitSlop={10} className="mr-2 px-1">
          <Text className="text-xs font-semibold text-slate-500">Go</Text>
        </Pressable>
        
        <TextInput
          className="flex-1 text-base text-black"
          placeholder="Search customers or bookings..."
          placeholderTextColor="#9ca3af" // Tailwind text-gray-400
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          autoFocus={true} // Keyboard opens immediately
        />

        {/* Clear Button (only shows when there's text) */}
        {query.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={12} className="ml-2">
            <Text className="text-xs font-semibold text-slate-500">Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}