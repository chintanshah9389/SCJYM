import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { brand, ui, shadows } from "../../lib/theme";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type NotificationsResponse = {
  items?: NotificationItem[];
};

type PendingRead = {
  id: string;
  timer: ReturnType<typeof setTimeout>;
};

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const pendingReadRef = useRef<PendingRead | null>(null);
  const [optimisticallyHiddenIds, setOptimisticallyHiddenIds] = useState<Set<string>>(new Set());
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (_error, id) => {
      setOptimisticallyHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (pendingReadId === id) {
        setPendingReadId(null);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (pendingReadRef.current?.timer) {
        clearTimeout(pendingReadRef.current.timer);
      }
    };
  }, []);

  const notifications = useMemo(() => {
    const source = data?.items ?? [];
    return source.filter((item) => !optimisticallyHiddenIds.has(item.id));
  }, [data?.items, optimisticallyHiddenIds]);

  function finalizePendingRead(id: string) {
    markRead.mutate(id);
    if (pendingReadId === id) {
      setPendingReadId(null);
    }
    if (pendingReadRef.current?.id === id) {
      pendingReadRef.current = null;
    }
  }

  function markAsReadWithUndo(id: string) {
    if (pendingReadRef.current?.timer) {
      clearTimeout(pendingReadRef.current.timer);
      finalizePendingRead(pendingReadRef.current.id);
    }

    setOptimisticallyHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setPendingReadId(id);

    const timer = setTimeout(() => finalizePendingRead(id), 4000);
    pendingReadRef.current = { id, timer };
  }

  function cancelPendingRead() {
    const pending = pendingReadRef.current;
    if (!pending) return;

    clearTimeout(pending.timer);
    setOptimisticallyHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(pending.id);
      return next;
    });
    setPendingReadId(null);
    pendingReadRef.current = null;
  }

  if (isLoading) return <ActivityIndicator size="large" color={brand.base} style={{ marginTop: 60 }} />;

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <Text style={styles.empty}>No notifications yet.</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, !item.read && styles.unread]}
              onPress={() => !item.read && markAsReadWithUndo(item.id)}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {pendingReadId ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>Marked as read</Text>
          <TouchableOpacity onPress={cancelPendingRead}>
            <Text style={styles.undoAction}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.pageBg, paddingTop: 6 },
  empty: { textAlign: "center", marginTop: 60, color: ui.textMuted, fontSize: 16 },
  item: {
    backgroundColor: ui.card,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.soft,
  },
  unread: { borderLeftWidth: 4, borderLeftColor: brand.base, backgroundColor: brand.tint },
  title: { fontSize: 15, fontWeight: "700", color: ui.text },
  body: { fontSize: 13, color: ui.textMuted, marginTop: 4, lineHeight: 18 },
  time: { fontSize: 11, color: "#8794b5", marginTop: 6, fontWeight: "600" },
  undoBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.card,
  },
  undoText: { color: "#f9fafb", fontSize: 13, fontWeight: "500" },
  undoAction: { color: "#93c5fd", fontSize: 13, fontWeight: "800" },
});
