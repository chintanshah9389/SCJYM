/**
 * NotifCarousel — horizontal mini-carousel of recent notifications.
 * Shows unread/recent notifications as swipable cards below the ad carousel.
 * Only renders when there are notifications to show.
 */
import React from "react";
import {
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

export default function NotifCarousel() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notif-carousel"],
    queryFn: () =>
      api.get("/notifications?limit=10").then((r) => r.data.data?.items ?? r.data.data ?? []),
    enabled: !!user,
    staleTime: 30_000,
  });

  if (!user || notifications.length === 0) return null;

  const unread = notifications.filter((n: any) => !(n.read ?? n.isRead));
  const display = unread.length > 0 ? unread : notifications.slice(0, 5);

  async function markAllRead() {
    await api.patch("/notifications/read-all").catch(() => {});
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
            <TouchableOpacity
              key={n.id}
              style={[styles.card, !n.isRead && styles.cardUnread, { borderLeftColor: color }]}
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
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    width: 220,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
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
});
