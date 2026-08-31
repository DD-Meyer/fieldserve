import { Pressable, Text, Alert } from "react-native";

const getSearchResults = (query?: string) => {
  // Search data and filter results based on user input
};

export const searchModelConfig = {
  title: "Search",
  message: "Search for customers and bookings",
  buttons: [
    {
      text: "Cancel",
      style: "cancel" as const,
    },
    {
      text: "Search",
      onPress: () => getSearchResults(),
    },
  ],
};

type Props = {
  onPress?: () => void;
};

export default function SearchButton({ onPress }: Props) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Alert.alert(
        searchModelConfig.title,
        searchModelConfig.message,
        searchModelConfig.buttons
      );
    }
  };

  return (
    <Pressable
      hitSlop={12}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityHint="Search for customers and bookings"
      accessibilityLabel="Search"
      className="h-10 px-3 items-center justify-center rounded-full active:bg-white/10"
    >
      <Text className="text-xs font-semibold text-slate-700">Search</Text>
    </Pressable>
  );
}