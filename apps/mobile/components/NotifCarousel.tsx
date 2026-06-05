/**
 * NotifCarousel — horizontal mini-carousel of recent notifications.
 * Shows unread/recent notifications as swipable cards below the ad carousel.
 * Only renders when there are notifications to show.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const TYPE_COLORS: Record<string, string> = {
  PRODUCT_APPROVED: "#059669",
  PRODUCT_REJECTED: "#ef4444",
  NEW_COMMENT: "#7c3aed",
  RANKING_UPDATE: "#d97706",
  SYSTEM: "#1a56db",
  BROADCAST: "#0891b2",
};

const TYPE_ICONS: Record<string, string> = {
  PRODUCT_APPROVED: "✅",
  PRODUCT_REJECTED: "❌",
  NEW_COMMENT: "💬",
  RANKING_UPDATE: "⭐",
  SYSTEM: "📢",
  BROADCAST: "📣",
};

const HOME_DISMISSED_KEY_PREFIX = "homeDismissedNotifications";

async function getStoredDismissedIds(userId: string): Promise<string[]> {
  const key = `${HOME_DISMISSED_KEY_PREFIX}:${userId}`;
  try {
    if (Platform.OS === "web") {
      const raw = (window as any).localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    }
    const { getItemAsync } = await import("expo-secure-store");
    const raw = await getItemAsync(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function storeDismissedIds(userId: string, ids: string[]): Promise<void> {
  const key = `${HOME_DISMISSED_KEY_PREFIX}:${userId}`;
  const payload = JSON.stringify(ids);
  if (Platform.OS === "web") {
    (window as any).localStorage.setItem(key, payload);
    return;
  }
  const { setItemAsync } = await import("expo-secure-store");
  await setItemAsync(key, payload);
}

export default function NotifCarousel() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [dismissedReady, setDismissedReady] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notif-carousel", user?.id],
    queryFn: () =>
      api.get("/notifications?limit=10").then((r) => r.data.data?.items ?? r.data.data ?? []),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: user ? 15_000 : false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setDismissedIds(new Set());
      setDismissedReady(true);
      return;
    }

    setDismissedReady(false);
    getStoredDismissedIds(user.id)
      .then((ids) => {
        if (!alive) return;
        setDismissedIds(new Set(ids));
      })
      .finally(() => {
        if (!alive) return;
        setDismissedReady(true);
      });

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const unread = useMemo(
    () =>
      notifications.filter(
        (n: any) => !(n.read ?? n.isRead) && !dismissedIds.has(n.id)
      ),
    [notifications, dismissedIds]
  );

  if (!user || !dismissedReady) return null;
  if (unread.length === 0) return null;

  const display = unread.slice(0, 5);

  async function dismissFromHome(id: string) {
    if (!user?.id) return;

    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
    await storeDismissedIds(user.id, Array.from(next));

    // Persist dismissal server-side so it does not reappear after refresh/login.
    await api
      .patch(`/notifications/${id}/read`, undefined, {
        headers: { "x-no-toast": "1" },
      })
      .catch(() => {});

    queryClient.invalidateQueries({ queryKey: ["notif-carousel"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all").catch(() => {});
    setDismissedIds((prev) => {
      const next = new Set(prev);
      unread.forEach((n: any) => next.add(n.id));
      if (user?.id) {
        void storeDismissedIds(user.id, Array.from(next));
      }
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ["notif-carousel"] });
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>🔔 Notifications</Text>
        <View style={styles.headerRight}>
          {unread.length > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push("/notifications" as any)}>
            <Text style={styles.seeAll}>See all ›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {display.map((n: any) => {
          const color = TYPE_COLORS[n.type] ?? "#1a56db";
          const icon = TYPE_ICONS[n.type] ?? "📌";
          return (
            <View
              key={n.id}
              style={[styles.card, styles.cardUnread, { borderLeftColor: color }]}
            >
              <TouchableOpacity
                style={styles.cardPressArea}
                onPress={() => router.push("/notifications" as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.cardIcon}>{icon}</Text>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{n.title}</Text>
                  <Text style={styles.cardMsg} numberOfLines={2}>{n.body}</Text>
                </View>
                {!(n.read ?? n.isRead) && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => dismissFromHome(n.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.dismissText}>x</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#111827" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  markAllBtn: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  markAllText: { fontSize: 11, color: "#6b7280", fontWeight: "500" },
  seeAll: { fontSize: 13, color: "#1a56db", fontWeight: "600" },
  scroll: { paddingHorizontal: 16, gap: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 0,
    width: 220,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressArea: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 8,
    minHeight: 84,
  },
  cardUnread: { backgroundColor: "#f0f9ff" },
  cardIcon: { fontSize: 20, marginTop: 1 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#111827" },
  cardMsg: { fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 16 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  dismissBtn: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  dismissText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
    lineHeight: 14,
  },
});
