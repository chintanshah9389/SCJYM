/**
 * Admin Advertisements — CRUD for the home carousel ads.
 * File: apps/mobile/app/admin/advertisements.tsx
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const MEDIA_TYPES = ["IMAGE", "VIDEO", "YOUTUBE"];
const LINK_TYPES = ["NONE", "SCREEN_ROUTE", "WEB_URL"];
const BADGE_PRESETS = ["", "NEW", "SALE", "LIVE", "HOT", "FEATURED"];

interface Ad {
  id: string;
  title: string;
  subtitle: string;
  mediaUrl: string;
  mediaType: string;
  linkTarget: string;
  linkType: string;
  isActive: boolean;
  sortOrder: number;
  badge: string;
  badgeColor: string;
}

const EMPTY_FORM: Omit<Ad, "id"> = {
  title: "",
  subtitle: "",
  mediaUrl: "",
  mediaType: "IMAGE",
  linkTarget: "",
  linkType: "NONE",
  isActive: true,
  sortOrder: 0,
  badge: "",
  badgeColor: "#ef4444",
};

export default function AdvertisementsScreen() {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const { data: ads = [], isLoading } = useQuery<Ad[]>({
    queryKey: ["admin-ads"],
    queryFn: () => api.get("/admin/ads").then((r) => r.data.data ?? []),
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  }

  function openEdit(ad: Ad) {
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      subtitle: ad.subtitle ?? "",
      mediaUrl: ad.mediaUrl,
      mediaType: ad.mediaType,
      linkTarget: ad.linkTarget ?? "",
      linkType: ad.linkType ?? "NONE",
      isActive: ad.isActive,
      sortOrder: ad.sortOrder ?? 0,
      badge: ad.badge ?? "",
      badgeColor: ad.badgeColor ?? "#ef4444",
    });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.mediaUrl.trim()) {
      Alert.alert("Required", "Title and Media URL are required.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/ads/${editingId}`, form);
      } else {
        await api.post("/admin/ads", form);
      }
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
      qc.invalidateQueries({ queryKey: ["ads-active"] });
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(ad: Ad) {
    try {
      await api.patch(`/admin/ads/${ad.id}/toggle`);
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
      qc.invalidateQueries({ queryKey: ["ads-active"] });
    } catch {
      Alert.alert("Error", "Could not toggle ad");
    }
  }

  function handleDelete(ad: Ad) {
    Alert.alert("Delete Ad", `Delete "${ad.title}"?`, [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/admin/ads/${ad.id}`).catch(() => {});
          qc.invalidateQueries({ queryKey: ["admin-ads"] });
          qc.invalidateQueries({ queryKey: ["ads-active"] });
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Advertisements ({ads.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ New Ad</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#1a56db" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {ads.length === 0 && (
            <Text style={styles.empty}>No advertisements yet. Tap "+ New Ad" to create one.</Text>
          )}
          {ads.map((ad) => (
            <View key={ad.id} style={[styles.card, !ad.isActive && styles.cardInactive]}>
              {/* Preview thumbnail */}
              {ad.mediaType === "IMAGE" && !!ad.mediaUrl ? (
                <Image source={{ uri: ad.mediaUrl }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbIcon}>{ad.mediaType === "YOUTUBE" ? "▶" : "🎬"}</Text>
                </View>
              )}

              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{ad.title}</Text>
                  {!!ad.badge && (
                    <View style={[styles.badge, { backgroundColor: ad.badgeColor }]}>
                      <Text style={styles.badgeText}>{ad.badge}</Text>
                    </View>
                  )}
                </View>
                {!!ad.subtitle && (
                  <Text style={styles.cardSubtitle} numberOfLines={1}>{ad.subtitle}</Text>
                )}
                <Text style={styles.cardMeta}>{ad.mediaType} · Order {ad.sortOrder}</Text>
                {!!ad.linkTarget && (
                  <Text style={styles.cardLink} numberOfLines={1}>🔗 {ad.linkTarget}</Text>
                )}

                <View style={styles.cardActions}>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{ad.isActive ? "Active" : "Inactive"}</Text>
                    <Switch
                      value={ad.isActive}
                      onValueChange={() => handleToggle(ad)}
                      trackColor={{ true: "#1a56db", false: "#d1d5db" }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(ad)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(ad)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Add/Edit Modal ─────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? "Edit Ad" : "New Advertisement"}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <Label>Title *</Label>
            <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Ad headline" />

            <Label>Subtitle</Label>
            <TextInput style={styles.input} value={form.subtitle} onChangeText={(v) => setForm((f) => ({ ...f, subtitle: v }))} placeholder="Short description" />

            <Label>Media URL *</Label>
            <TextInput style={styles.input} value={form.mediaUrl} onChangeText={(v) => setForm((f) => ({ ...f, mediaUrl: v }))} placeholder="https://..." autoCapitalize="none" />

            {/* Media type chips */}
            <Label>Media Type</Label>
            <View style={styles.chipRow}>
              {MEDIA_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, form.mediaType === t && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, mediaType: t }))}>
                  <Text style={[styles.chipText, form.mediaType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Label>On Tap — Link Type</Label>
            <View style={styles.chipRow}>
              {LINK_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, form.linkType === t && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, linkType: t }))}>
                  <Text style={[styles.chipText, form.linkType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.linkType !== "NONE" && (
              <>
                <Label>Link Target</Label>
                <TextInput style={styles.input} value={form.linkTarget} onChangeText={(v) => setForm((f) => ({ ...f, linkTarget: v }))} placeholder="e.g. /(tabs)/products or https://..." autoCapitalize="none" />
              </>
            )}

            <Label>Badge</Label>
            <View style={styles.chipRow}>
              {BADGE_PRESETS.map((b) => (
                <TouchableOpacity key={b || "none"} style={[styles.chip, form.badge === b && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, badge: b }))}>
                  <Text style={[styles.chipText, form.badge === b && styles.chipTextActive]}>{b || "None"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Label>Sort Order</Label>
            <TextInput style={styles.input} value={String(form.sortOrder)} onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: parseInt(v) || 0 }))} keyboardType="numeric" placeholder="0" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <Switch value={form.isActive} onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))} trackColor={{ true: "#1a56db", false: "#d1d5db" }} thumbColor="#fff" />
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingId ? "Save Changes" : "Create Ad"}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f9fafb" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  topBarTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  addBtn: { backgroundColor: "#1a56db", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  list: { padding: 16, gap: 12 },
  empty: { color: "#9ca3af", textAlign: "center", marginTop: 40, fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", flexDirection: "row", gap: 12, padding: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardInactive: { opacity: 0.55 },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#f3f4f6" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  thumbIcon: { fontSize: 28 },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111827" },
  badge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 2 },
  cardMeta: { fontSize: 11, color: "#9ca3af", marginBottom: 2 },
  cardLink: { fontSize: 11, color: "#1a56db", marginBottom: 6 },
  cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggleLabel: { fontSize: 12, color: "#6b7280" },
  btnRow: { flexDirection: "row", gap: 8 },
  editBtn: { backgroundColor: "#eff6ff", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText: { color: "#1a56db", fontSize: 12, fontWeight: "600" },
  deleteBtn: { backgroundColor: "#fef2f2", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
  // Modal
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalClose: { fontSize: 20, color: "#9ca3af" },
  modalBody: { padding: 20, gap: 4, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 9, padding: 11, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { borderColor: "#1a56db", backgroundColor: "#eff6ff" },
  chipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  chipTextActive: { color: "#1a56db", fontWeight: "700" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
  switchLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  saveBtn: { backgroundColor: "#1a56db", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
