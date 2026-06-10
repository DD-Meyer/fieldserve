import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";

type Props = {
  title: string;
  subtitle?: string;
  rightAction?: { label: string; onPress: () => void };
  children?: React.ReactNode;
};

export default function ScreenScaffold({
  title,
  subtitle,
  rightAction,
  children,
}: Props) {
  const router = useRouter();
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerLeft: () => (
            <Pressable
              hitSlop={12}
              onPress={() => router.back()}
              className="pl-2 pr-3 active:opacity-60"
              accessibilityLabel="Back"
            >
              <Text className="text-base text-blue-600">‹ Back</Text>
            </Pressable>
          ),
          headerRight: rightAction
            ? () => (
                <Pressable
                  hitSlop={12}
                  onPress={rightAction.onPress}
                  className="pr-3 pl-2 active:opacity-60"
                >
                  <Text className="text-base text-blue-600 font-semibold">
                    {rightAction.label}
                  </Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {subtitle ? (
          <Text className="text-sm text-slate-500 mb-4 px-1">{subtitle}</Text>
        ) : null}
        {children ?? (
          <View className="bg-white rounded-xl p-5 border border-slate-200">
            <Text className="text-slate-600">Coming soon.</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}
