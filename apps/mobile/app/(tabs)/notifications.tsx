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
import { useAuth } from "../../context/AuthContext";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  receiptData?: {
    receiptNum?: string;
    header?: string;
    body?: string;
    formattedText?: string;
    generatedAt?: string;
  };
};

type NotificationsResponse = {
  items?: NotificationItem[];
};

type PendingRead = {
  id: string;
  timer: ReturnType<typeof setTimeout>;
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pendingReadRef = useRef<PendingRead | null>(null);
  const [optimisticallyHiddenIds, setOptimisticallyHiddenIds] = useState<Set<string>>(new Set());
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.get("/notifications").then((r) => r.data.data),
    enabled: !!user,
    refetchInterval: user ? 15_000 : false,
    refetchOnReconnect: true,
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

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

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

  function renderReceiptBlock(item: NotificationItem) {
    const receipt = item.receiptData;
    if (!receipt) return null;

    const previewText = (receipt.formattedText ?? item.body ?? "").trim();
    const compactPreview = previewText.length > 420 ? `${previewText.slice(0, 420)}...` : previewText;

    return (
      <View style={styles.receiptCard}>
        <View style={styles.receiptHeaderRow}>
          <Text style={styles.receiptBadge}>Receipt</Text>
          <Text style={styles.receiptNumber}>{receipt.receiptNum ?? "-"}</Text>
        </View>
        {receipt.header ? <Text style={styles.receiptHeading}>{receipt.header}</Text> : null}
        <Text style={styles.receiptPreview}>{compactPreview}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <Text style={styles.empty}>No notifications yet.</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, !item.read && styles.unread]}
              onPress={() => !item.read && markAsReadWithUndo(item.id)}
            >
              <Text style={styles.title}>{item.title}</Text>
              {item.receiptData ? (
                renderReceiptBlock(item)
              ) : (
                <Text style={styles.body}>{item.body}</Text>
              )}
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
  receiptCard: {
    marginTop: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbeafe",
    padding: 10,
  },
  receiptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  receiptBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  receiptNumber: { fontSize: 12, fontWeight: "700", color: "#1e3a8a" },
  receiptHeading: { fontSize: 13, fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  receiptPreview: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 17,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
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
