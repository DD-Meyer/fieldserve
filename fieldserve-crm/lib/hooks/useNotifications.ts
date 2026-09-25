import { useAuth } from "@clerk/expo";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API_BASE, useApi } from "../api";

export type Notification = {
  id: number;
  user: number;
  title: string;
  message: string;
  read: boolean;
  archived: boolean;
  created_at: string;
};

export type NotificationPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
};

export type NotificationFilter = "all" | "unread" | "archived";

export function useNotificationSocket() {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSignedIn) return;

    let socket: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      const websocketBase = API_BASE.replace(/^http/, "ws");
      socket = new WebSocket(
        `${websocketBase}/ws/notifications/?token=${encodeURIComponent(token)}`,
      );
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "notification.created") {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
        } catch {
          // Ignore malformed messages and keep the live connection open.
        }
      };
      socket.onclose = () => {
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [getToken, isSignedIn, queryClient]);
}

export function useNotifications(filter: NotificationFilter = "all") {
  const api = useApi();
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["notifications", filter],
    queryFn: () =>
      api.get<NotificationPage>("/api/notifications/", {
        read: filter === "unread" ? false : undefined,
        archived: filter === "archived" ? true : undefined,
        ordering: "-created_at",
      }),
    staleTime: 15_000,
    enabled: !!isSignedIn,
  });
}

export function useUnreadNotificationCount() {
  const api = useApi();
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      api.get<NotificationPage>("/api/notifications/", {
        read: false,
        ordering: "-created_at",
      }),
    staleTime: 15_000,
    enabled: !!isSignedIn,
    select: (data) => data.count,
  });
}

export function useMarkNotificationRead() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.patch<Notification>(`/api/notifications/${id}/`, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const unread = await api.get<NotificationPage>("/api/notifications/", {
        read: false,
      });
      await Promise.all(
        unread.results.map((notification) =>
          api.patch<Notification>(`/api/notifications/${notification.id}/`, {
            read: true,
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useSetNotificationArchived() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) =>
      api.patch<Notification>(`/api/notifications/${id}/`, { archived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
