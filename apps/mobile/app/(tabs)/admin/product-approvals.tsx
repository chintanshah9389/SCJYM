/**
 * Admin: Approve / reject submitted products.
 * File: apps/mobile/app/admin/product-approvals.tsx
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "@/lib/theme";

export default function ProductApprovalsScreen() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-pending-products", page],
    queryFn: () =>
      api.get("/products", { params: { status: "SUBMITTED", page, limit: 20 } }).then((r) => r.data.data),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.patch(`/products/${id}/approval`, { status, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pending-products"] }),
  });

  const products = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color={brand.base} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No products pending approval.</Text>}
          renderItem={({ item: p }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{p.title}</Text>
              <Text style={styles.sub}>Category: {p.category}</Text>
              <Text style={styles.sub}>Price: ₹{p.price}</Text>
              {p.description && (
                <Text style={styles.desc} numberOfLines={2}>{p.description}</Text>
              )}
              <Text style={styles.date}>
                Submitted: {new Date(p.updatedAt ?? p.createdAt).toLocaleDateString()}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={styles.approveBtn}
                  onPress={() =>
                    Alert.alert("Approve Product", `Approve "${p.title}"?`, [
                      { text: "Cancel" },
                      {
                        text: "Approve",
                        onPress: () => approveMut.mutate({ id: p.id, status: "APPROVED" }),
                      },
                    ])
                  }
                >
                  <Text style={styles.btnText}>✓ Approve</Text>
                </Pressable>
                <Pressable
                  style={styles.rejectBtn}
                  onPress={() => { setRejectModal({ id: p.id, title: p.title }); setRejectReason(""); }}
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

      {/* Reject reason modal */}
      <Modal visible={!!rejectModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reject Product</Text>
            <Text style={styles.modalSub}>"{rejectModal?.title}"</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for rejection (shown to submitter)..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              value={rejectReason}
              onChangeText={setRejectReason}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setRejectModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmRejectBtn}
                onPress={() => {
                  if (rejectModal) approveMut.mutate({ id: rejectModal.id, status: "REJECTED", reason: rejectReason });
                  setRejectModal(null);
                }}
              >
                <Text style={styles.btnText}>Confirm Reject</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.pageBg },
  card: {
    backgroundColor: ui.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  name: { fontSize: 16, fontWeight: "700", color: ui.text, marginBottom: 4 },
  sub: { fontSize: 13, color: ui.textMuted },
  desc: { fontSize: 13, color: "#334155", marginTop: 6, fontStyle: "italic" },
  date: { fontSize: 12, color: "#9ca3af", marginTop: 4, marginBottom: 10 },
  actions: { flexDirection: "row", gap: 10 },
  approveBtn: { flex: 1, backgroundColor: "#059669", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  rejectBtn: { flex: 1, backgroundColor: "#dc2626", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { textAlign: "center", marginTop: 60, color: ui.textMuted, fontSize: 15 },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderTopWidth: 1, borderColor: ui.border },
  pageBtn: { fontSize: 15, color: brand.base, fontWeight: "700", paddingHorizontal: 8 },
  pageInfo: { fontSize: 13, color: ui.textMuted },
  disabled: { color: "#d1d5db" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: ui.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderTopWidth: 1, borderColor: ui.border },
  modalTitle: { fontSize: 18, fontWeight: "700", color: ui.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: ui.textMuted, marginBottom: 14 },
  reasonInput: { borderWidth: 1, borderColor: ui.border, borderRadius: 10, padding: 12, fontSize: 14, height: 100, color: ui.text, backgroundColor: "#f8faff" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: ui.border, borderRadius: 10, paddingVertical: 12, alignItems: "center", backgroundColor: "#f8faff" },
  cancelBtnText: { fontSize: 14, color: "#334155", fontWeight: "600" },
  confirmRejectBtn: { flex: 1, backgroundColor: "#dc2626", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
});
