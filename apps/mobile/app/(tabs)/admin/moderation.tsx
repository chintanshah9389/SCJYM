/**
 * Admin: Comment moderation — approve or reject flagged comments.
 * File: apps/mobile/app/admin/moderation.tsx
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#d97706",
  APPROVED: "#059669",
  REJECTED: "#dc2626",
};

export default function ModerationScreen() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-comments", page, statusFilter],
    queryFn: () =>
      api
        .get("/admin/comments", { params: { status: statusFilter, page, limit: 20 } })
        .then((r) => r.data.data),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/admin/comments/${id}/moderate`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-comments"] }),
  });

  const comments = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function confirmAction(id: string, action: "APPROVE" | "REJECT") {
    Alert.alert(
      action === "APPROVE" ? "Approve Comment" : "Reject Comment",
      `Are you sure you want to ${action.toLowerCase()} this comment?`,
      [
        { text: "Cancel" },
        { text: action === "APPROVE" ? "Approve" : "Reject", onPress: () => actionMut.mutate({ id, action }) },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <Pressable
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => { setStatusFilter(s); setPage(1); }}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No comments found.</Text>}
          renderItem={({ item: c }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.user}>{c.userFullName ?? "Unknown User"}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[c.status] + "20" }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLOR[c.status] }]}>{c.status}</Text>
                </View>
              </View>
              <Text style={styles.commentText}>"{c.text}"</Text>
              {c.productTitle && (
                <Text style={styles.sub}>Product: {c.productTitle}</Text>
              )}
              <Text style={styles.date}>{new Date(c.createdAt).toLocaleDateString()}</Text>
              {c.status === "PENDING" && (
                <View style={styles.actions}>
                  <Pressable style={styles.approveBtn} onPress={() => confirmAction(c.id, "APPROVE")}>
                    <Text style={styles.btnText}>✓ Approve</Text>
                  </Pressable>
                  <Pressable style={styles.rejectBtn} onPress={() => confirmAction(c.id, "REJECT")}>
                    <Text style={styles.btnText}>✕ Reject</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}

      <View style={styles.pagination}>
        <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          <Text style={[styles.pageBtn, page <= 1 && styles.disabled]}>‹ Prev</Text>
        </Pressable>
        <Text style={styles.pageInfo}>Page {page} of {totalPages}</Text>
        <Pressable onPress={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
          <Text style={[styles.pageBtn, page >= totalPages && styles.disabled]}>Next ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  filterRow: { flexDirection: "row", padding: 12, gap: 8 },
  filterChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#fff" },
  filterChipActive: { backgroundColor: "#1a56db", borderColor: "#1a56db" },
  filterChipText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  filterChipTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, elevation: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  user: { fontSize: 14, fontWeight: "700", color: "#111827" },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  commentText: { fontSize: 14, color: "#374151", fontStyle: "italic", marginBottom: 6 },
  sub: { fontSize: 12, color: "#6b7280" },
  date: { fontSize: 11, color: "#9ca3af", marginTop: 2, marginBottom: 10 },
  actions: { flexDirection: "row", gap: 10 },
  approveBtn: { flex: 1, backgroundColor: "#059669", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  rejectBtn: { flex: 1, backgroundColor: "#dc2626", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 15 },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderTopWidth: 1, borderColor: "#f3f4f6" },
  pageBtn: { fontSize: 15, color: "#1a56db", fontWeight: "600", paddingHorizontal: 8 },
  pageInfo: { fontSize: 13, color: "#6b7280" },
  disabled: { color: "#d1d5db" },
});
