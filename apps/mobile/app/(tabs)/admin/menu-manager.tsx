/**
 * Admin: Dynamic Menu Manager — add / edit / delete / reorder menu items.
 * File: apps/mobile/app/admin/menu-manager.tsx
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const ITEM_TYPES = ["SCREEN_ROUTE", "YOUTUBE_URL", "LIVE_URL", "CATEGORY_FILTER", "EXTERNAL_URL"];

interface MenuItem {
  id: string;
  label: string;
  type: string;
  target: string;
  order: number;
  enabled: boolean;
}

interface MenuFormState {
  label: string;
  type: string;
  target: string;
  order: string;
  enabled: boolean;
}

const EMPTY_FORM: MenuFormState = { label: "", type: "SCREEN_ROUTE", target: "", order: "0", enabled: true };

export default function MenuManagerScreen() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; item?: MenuItem } | null>(null);
  const [form, setForm] = useState<MenuFormState>(EMPTY_FORM);

  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: () => api.get("/admin/menu").then((r) => r.data.data ?? []),
  });

  const saveMut = useMutation({
    mutationFn: (payload: any) =>
      modal?.mode === "edit" && modal.item
        ? api.patch(`/admin/menu/${modal.item.id}`, payload)
        : api.post("/admin/menu", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-menu"] }); setModal(null); },
    onError: (e: any) => Alert.alert("Error", e?.response?.data?.error?.message ?? "Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/menu/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-menu"] }),
  });

  function openAdd() {
    setForm(EMPTY_FORM);
    setModal({ mode: "add" });
  }

  function openEdit(item: MenuItem) {
    setForm({ label: item.label, type: item.type, target: item.target, order: String(item.order), enabled: item.enabled });
    setModal({ mode: "edit", item });
  }

  function confirmDelete(item: MenuItem) {
    Alert.alert("Delete Item", `Delete "${item.label}"?`, [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate(item.id) },
    ]);
  }

  function handleSave() {
    if (!form.label.trim() || !form.target.trim()) {
      Alert.alert("Validation", "Label and target are required.");
      return;
    }
    saveMut.mutate({ ...form, order: parseInt(form.order) || 0 });
  }

  if (isLoading) return <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 60 }} />;

  return (
    <View style={styles.container}>
      <Pressable style={styles.addBtn} onPress={openAdd}>
        <Text style={styles.addBtnText}>+ Add Menu Item</Text>
      </Pressable>

      <FlatList
        data={(items ?? []) as MenuItem[]}
        keyExtractor={(i) => i.id}
        refreshing={isLoading}
        onRefresh={refetch}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No menu items yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.label}>{item.label}</Text>
                <View style={[styles.enabledDot, { backgroundColor: item.enabled ? "#059669" : "#d1d5db" }]} />
              </View>
              <Text style={styles.type}>{item.type}</Text>
              <Text style={styles.target} numberOfLines={1}>{item.target}</Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable style={styles.editBtn} onPress={() => openEdit(item)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
                <Text style={styles.deleteBtnText}>Del</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      {/* Add / Edit Modal */}
      <Modal visible={!!modal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{modal?.mode === "edit" ? "Edit" : "Add"} Menu Item</Text>

            <Text style={styles.fieldLabel}>Label *</Text>
            <TextInput style={styles.input} value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="e.g., Flash Sale" placeholderTextColor="#9ca3af" />

            <Text style={styles.fieldLabel}>Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {ITEM_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeChip, form.type === t && styles.typeChipActive]}
                  onPress={() => setForm((f) => ({ ...f, type: t }))}
                >
                  <Text style={[styles.typeChipText, form.type === t && styles.typeChipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Target *</Text>
            <TextInput style={styles.input} value={form.target} onChangeText={(v) => setForm((f) => ({ ...f, target: v }))} placeholder="Route / URL / category ID" placeholderTextColor="#9ca3af" autoCapitalize="none" />

            <Text style={styles.fieldLabel}>Sort Order</Text>
            <TextInput style={styles.input} value={form.order} onChangeText={(v) => setForm((f) => ({ ...f, order: v }))} keyboardType="numeric" placeholder="0" placeholderTextColor="#9ca3af" />

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Enabled</Text>
              <Switch value={form.enabled} onValueChange={(v) => setForm((f) => ({ ...f, enabled: v }))} trackColor={{ true: "#1a56db" }} />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModal(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saveMut.isPending}>
                {saveMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  addBtn: { margin: 12, backgroundColor: "#1a56db", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty: { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 15 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", elevation: 1 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  label: { fontSize: 15, fontWeight: "700", color: "#111827" },
  enabledDot: { width: 8, height: 8, borderRadius: 4 },
  type: { fontSize: 12, color: "#1a56db", fontWeight: "600" },
  target: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardActions: { gap: 6, justifyContent: "center" },
  editBtn: { backgroundColor: "#e0f2fe", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText: { color: "#0369a1", fontSize: 12, fontWeight: "700" },
  deleteBtn: { backgroundColor: "#fee2e2", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  deleteBtnText: { color: "#dc2626", fontSize: 12, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#111827" },
  typeChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: "#fff" },
  typeChipActive: { backgroundColor: "#1a56db", borderColor: "#1a56db" },
  typeChipText: { fontSize: 12, color: "#374151", fontWeight: "600" },
  typeChipTextActive: { color: "#fff" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 14, color: "#374151", fontWeight: "600" },
  saveBtn: { flex: 1, backgroundColor: "#1a56db", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
