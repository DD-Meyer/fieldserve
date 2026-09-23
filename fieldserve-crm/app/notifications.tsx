import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { styled } from "nativewind";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../components/AppHeader";
import { useRefresh } from "../hooks/useRefresh";
import { useTabBarSpace } from "../hooks/useTabBarSpace";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationSocket,
  useSetNotificationArchived,
  useNotifications,
  type Notification,
  type NotificationFilter,
} from "../lib/hooks/useNotifications";
import "../global.css";

const SafeAreaView = styled(RNSafeAreaView);

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "archived", label: "Archived" },
];

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function NotificationRow({
  notification,
  onPress,
  onArchive,
}: {
  notification: Notification;
  onPress: () => void;
  onArchive: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notification.read ? "Read" : "Unread"} notification: ${notification.title}`}
      onPress={onPress}
      className={`mb-3 rounded-2xl border px-4 py-4 ${notification.read ? "border-slate-200 bg-white" : "border-blue-100 bg-blue-50"}`}
    >
      <View className="flex-row items-start">
        <View className={`mr-3 mt-0.5 h-9 w-9 items-center justify-center rounded-full ${notification.read ? "bg-slate-100" : "bg-blue-100"}`}>
          <Ionicons
            name={notification.read ? "notifications-outline" : "notifications"}
            size={18}
            color={notification.read ? "#64748B" : "#2563EB"}
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text className={`flex-1 text-sm ${notification.read ? "font-semibold text-slate-800" : "font-bold text-slate-950"}`}>
              {notification.title}
            </Text>
            <Text className="text-[11px] text-slate-400">{relativeTime(notification.created_at)}</Text>
          </View>
          {notification.message ? (
            <Text className="mt-1 text-xs leading-5 text-slate-500">{notification.message}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={notification.archived ? "Restore notification" : "Archive notification"}
          hitSlop={10}
          onPress={onArchive}
          className="ml-2 p-1"
        >
          <Ionicons
            name={notification.archived ? "arrow-undo-outline" : "archive-outline"}
            size={18}
            color="#64748B"
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const tabBarSpace = useTabBarSpace();
  useNotificationSocket();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const { data, isLoading, error, refetch } = useNotifications(filter);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const setArchived = useSetNotificationArchived();
  const { refreshing, onRefresh } = useRefresh([refetch]);
  const notifications = useMemo(() => data?.results ?? [], [data?.results]);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppHeader title="Notifications" back />
      <View className="flex-row items-center justify-between px-4 pb-3 pt-4">
        <View className="flex-row rounded-lg border border-slate-200 bg-slate-100 p-1">
          {FILTERS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.key }}
              onPress={() => setFilter(item.key)}
              className={`rounded-md px-4 py-2 ${filter === item.key ? "bg-white" : ""}`}
            >
              <Text className={`text-xs font-semibold ${filter === item.key ? "text-slate-900" : "text-slate-500"}`}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {filter === "all" && unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            disabled={markAllRead.isPending}
            onPress={() => markAllRead.mutate()}
          >
            <Text className="text-xs font-semibold text-blue-600">Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2563EB" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm font-semibold text-slate-800">Could not load notifications.</Text>
          <Pressable onPress={() => refetch()} className="mt-3 rounded-lg bg-blue-600 px-4 py-2">
            <Text className="text-xs font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: tabBarSpace + 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              onPress={() => {
                if (!item.read) markRead.mutate(item.id);
              }}
              onArchive={() => setArchived.mutate({ id: item.id, archived: !item.archived })}
            />
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="notifications-off-outline" size={32} color="#94A3B8" />
              <Text className="mt-3 text-center text-sm font-semibold text-slate-700">
                {filter === "unread"
                  ? "You are all caught up."
                  : filter === "archived"
                    ? "No archived notifications."
                    : "No notifications yet."}
              </Text>
              <Text className="mt-1 text-center text-xs leading-5 text-slate-500">
                Updates about your bookings and FieldServe account will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
