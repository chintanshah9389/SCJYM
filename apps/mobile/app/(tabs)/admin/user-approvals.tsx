/**
 * Admin: Approve / reject pending user registrations.
 * File: apps/mobile/app/admin/user-approvals.tsx
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "@/lib/theme";

export default function UserApprovalsScreen() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-pending-users", page, search],
    queryFn: () =>
      api
        .get("/users", { params: { status: "PENDING", q: search || undefined, page, limit: 20 } })
        .then((r) => r.data.data),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) =>
      api.patch(`/users/${id}/approval`, { action, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pending-users"] }),
  });

  const users = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function confirmAction(id: string, fullName: string, action: "APPROVE" | "REJECT") {
    if (action === "APPROVE") {
      Alert.alert("Approve User", `Approve "${fullName}"?`, [
        { text: "Cancel" },
        { text: "Approve", style: "default", onPress: () => actionMut.mutate({ id, action }) },
      ]);
    } else {
      Alert.prompt(
        "Reject User",
        `Reason for rejecting "${fullName}" (optional):`,
        (reason) => actionMut.mutate({ id, action, reason }),
        "plain-text",
        "",
      );
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by name / email..."
        value={search}
        onChangeText={(v) => { setSearch(v); setPage(1); }}
        placeholderTextColor="#9ca3af"
      />

      {isLoading ? (
        <ActivityIndicator size="large" color={brand.base} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(i) => i.id}
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <Text style={styles.empty}>No pending users.</Text>
          }
          renderItem={({ item: u }) => (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{u.fullName}</Text>
                <Text style={styles.sub}>{u.email}</Text>
                <Text style={styles.sub}>{u.mobile}</Text>
                {u.address?.city && (
                  <Text style={styles.sub}>
                    {u.address.city}, {u.address.state}
                  </Text>
                )}
                <Text style={styles.date}>
                  Registered: {new Date(u.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={styles.approveBtn}
                  onPress={() => confirmAction(u.id, u.fullName, "APPROVE")}
                >
                  <Text style={styles.btnText}>✓ Approve</Text>
                </Pressable>
                <Pressable
                  style={styles.rejectBtn}
                  onPress={() => confirmAction(u.id, u.fullName, "REJECT")}
                >
                  <Text style={styles.btnText}>✕ Reject</Text>
                </Pressable>
              </View>
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
  container: { flex: 1, backgroundColor: ui.pageBg },
  search: {
    margin: 12,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: ui.card,
    color: ui.text,
    ...shadows.soft,
  },
  card: {
    backgroundColor: ui.card,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    gap: 10,
    ...shadows.card,
  },
  cardBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: ui.text, marginBottom: 2 },
  sub: { fontSize: 13, color: ui.textMuted },
  date: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  actions: { gap: 8, justifyContent: "center" },
  approveBtn: { backgroundColor: "#059669", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  rejectBtn: { backgroundColor: "#dc2626", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 60, color: ui.textMuted, fontSize: 15 },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderTopWidth: 1, borderColor: ui.border },
  pageBtn: { fontSize: 15, color: brand.base, fontWeight: "700", paddingHorizontal: 8 },
  pageInfo: { fontSize: 13, color: ui.textMuted },
  disabled: { color: "#d1d5db" },
});
