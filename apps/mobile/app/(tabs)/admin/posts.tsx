import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "@/lib/theme";

const BADGE_PRESETS = ["", "NEW", "SALE", "LIVE", "HOT", "FEATURED"];

interface AdminPost {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  ctaLabel: string;
  mediaUrl: string;
  mediaType: string;
  linkType: string;
  linkTarget: string;
  isActive: boolean;
  sortOrder: number;
  badge: string;
  badgeColor: string;
}

const EMPTY_FORM = {
  title: "",
  subtitle: "",
  content: "",
  ctaLabel: "Read more",
  mediaUrl: "",
  mediaType: "IMAGE",
  linkType: "POST_PAGE",
  linkTarget: "",
  isActive: true,
  sortOrder: 0,
  badge: "",
  badgeColor: "#ef4444",
};

export default function AdminPostsScreen() {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: posts = [], isLoading } = useQuery<AdminPost[]>({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const items = await api.get("/admin/ads").then((r) => r.data.data ?? []);
      return items.filter((item: AdminPost) => item.linkType === "POST_PAGE");
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  }

  function openEdit(post: AdminPost) {
    setEditingId(post.id);
    setForm({
      title: post.title ?? "",
      subtitle: post.subtitle ?? "",
      content: post.content ?? "",
      ctaLabel: post.ctaLabel ?? "Read more",
      mediaUrl: post.mediaUrl ?? "",
      mediaType: post.mediaType ?? "IMAGE",
      linkType: "POST_PAGE",
      linkTarget: "",
      isActive: post.isActive ?? true,
      sortOrder: post.sortOrder ?? 0,
      badge: post.badge ?? "",
      badgeColor: post.badgeColor ?? "#ef4444",
    });
    setModalVisible(true);
  }

  async function handlePickImage() {
    setUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const formData = new FormData();
        const filename = asset.uri.split("/").pop() || "post-image.jpg";
        formData.append("file", {
          uri: Platform.OS === "android" ? asset.uri : asset.uri.replace("file://", ""),
          type: asset.type || "image/jpeg",
          name: filename,
        } as any);

        const response = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data?.data?.url) {
          setForm((current) => ({ ...current, mediaUrl: response.data.data.url }));
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim() || !form.mediaUrl.trim() || !form.content.trim()) {
      Alert.alert("Required", "Title, image, and post content are required.");
      return;
    }

    const payload = {
      ...form,
      linkType: "POST_PAGE",
      linkTarget: "",
      mediaType: "IMAGE",
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/ads/${editingId}`, payload);
      } else {
        await api.post("/admin/ads", payload);
      }
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
      qc.invalidateQueries({ queryKey: ["ads-active"] });
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(post: AdminPost) {
    try {
      await api.patch(`/admin/ads/${post.id}/toggle`);
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
      qc.invalidateQueries({ queryKey: ["ads-active"] });
    } catch {
      Alert.alert("Error", "Could not toggle post");
    }
  }

  function handleDelete(post: AdminPost) {
    Alert.alert("Delete Post", `Delete \"${post.title}\"?`, [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/admin/ads/${post.id}`).catch(() => {});
          qc.invalidateQueries({ queryKey: ["admin-posts"] });
          qc.invalidateQueries({ queryKey: ["admin-ads"] });
          qc.invalidateQueries({ queryKey: ["ads-active"] });
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Posts in Carousel</Text>
          <Text style={styles.topBarSub}>Admins can create a post, show it on home, and open it on tap.</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ New Post</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={brand.base} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {posts.length === 0 && (
            <Text style={styles.empty}>No posts yet. Tap "+ New Post" to add one to the home carousel.</Text>
          )}
          {posts.map((post) => (
            <View key={post.id} style={[styles.card, !post.isActive && styles.cardInactive]}>
              <Image source={{ uri: post.mediaUrl }} style={styles.thumb} resizeMode="cover" />
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{post.title}</Text>
                  {!!post.badge && (
                    <View style={[styles.badge, { backgroundColor: post.badgeColor }]}>
                      <Text style={styles.badgeText}>{post.badge}</Text>
                    </View>
                  )}
                </View>
                {!!post.subtitle && <Text style={styles.cardSubtitle} numberOfLines={1}>{post.subtitle}</Text>}
                <Text style={styles.cardExcerpt} numberOfLines={2}>{post.content}</Text>
                <Text style={styles.cardMeta}>Carousel order: {post.sortOrder}</Text>
                <Text style={styles.cardMeta}>Tap action: Opens post page</Text>
                <View style={styles.cardActions}>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{post.isActive ? "Active" : "Inactive"}</Text>
                    <Switch
                      value={post.isActive}
                      onValueChange={() => handleToggle(post)}
                      trackColor={{ true: brand.base, false: "#d1d5db" }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(post)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(post)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? "Edit Post" : "Create Post"}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <Label>Title *</Label>
            <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm((current) => ({ ...current, title: v }))} placeholder="Post headline" />

            <Label>Subtitle</Label>
            <TextInput style={styles.input} value={form.subtitle} onChangeText={(v) => setForm((current) => ({ ...current, subtitle: v }))} placeholder="Short summary for the carousel" />

            <Label>Post Content *</Label>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.content}
              onChangeText={(v) => setForm((current) => ({ ...current, content: v }))}
              placeholder="Full content shown on the post detail page"
              multiline
              textAlignVertical="top"
            />

            <Label>Carousel Image *</Label>
            <View style={styles.mediaInputRow}>
              <TextInput style={[styles.input, styles.mediaInputField]} value={form.mediaUrl} onChangeText={(v) => setForm((current) => ({ ...current, mediaUrl: v }))} placeholder="https://..." autoCapitalize="none" />
              <TouchableOpacity style={styles.uploadMediaBtn} onPress={handlePickImage} disabled={uploading}>
                <Text style={styles.uploadMediaBtnText}>{uploading ? "↻" : "📷"}</Text>
              </TouchableOpacity>
            </View>

            <Label>Button Label</Label>
            <TextInput style={styles.input} value={form.ctaLabel} onChangeText={(v) => setForm((current) => ({ ...current, ctaLabel: v }))} placeholder="Read more" />

            <Label>Badge</Label>
            <View style={styles.chipRow}>
              {BADGE_PRESETS.map((badge) => (
                <TouchableOpacity key={badge || "none"} style={[styles.chip, form.badge === badge && styles.chipActive]} onPress={() => setForm((current) => ({ ...current, badge }))}>
                  <Text style={[styles.chipText, form.badge === badge && styles.chipTextActive]}>{badge || "None"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Label>Sort Order</Label>
            <TextInput style={styles.input} value={String(form.sortOrder)} onChangeText={(v) => setForm((current) => ({ ...current, sortOrder: Number.parseInt(v, 10) || 0 }))} keyboardType="numeric" placeholder="0" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Show in carousel</Text>
              <Switch value={form.isActive} onValueChange={(v) => setForm((current) => ({ ...current, isActive: v }))} trackColor={{ true: brand.base, false: "#d1d5db" }} thumbColor="#fff" />
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingId ? "Save Post" : "Create Post"}</Text>}
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
  root: { flex: 1, backgroundColor: ui.pageBg },
  topBar: {
    padding: 16,
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  topBarTitle: { fontSize: 17, fontWeight: "800", color: ui.text },
  topBarSub: { marginTop: 4, fontSize: 12, lineHeight: 17, color: ui.textMuted, maxWidth: 220 },
  addBtn: { backgroundColor: brand.base, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, ...shadows.soft },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  list: { padding: 16, gap: 12, paddingBottom: 30 },
  empty: { color: ui.textMuted, textAlign: "center", marginTop: 40, fontSize: 14 },
  card: { backgroundColor: ui.card, borderRadius: 14, overflow: "hidden", flexDirection: "row", gap: 12, padding: 12, borderWidth: 1, borderColor: ui.border, ...shadows.card },
  cardInactive: { opacity: 0.55 },
  thumb: { width: 84, height: 84, borderRadius: 10, backgroundColor: "#eef2ff" },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: ui.text },
  badge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardSubtitle: { fontSize: 13, color: ui.textMuted, marginBottom: 4 },
  cardExcerpt: { fontSize: 12, lineHeight: 18, color: ui.text, marginBottom: 4 },
  cardMeta: { fontSize: 11, color: "#94a3b8", marginBottom: 2 },
  cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggleLabel: { fontSize: 12, color: ui.textMuted },
  btnRow: { flexDirection: "row", gap: 8 },
  editBtn: { backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText: { color: brand.base, fontSize: 12, fontWeight: "700" },
  deleteBtn: { backgroundColor: "#fef2f2", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
  modal: { flex: 1, backgroundColor: ui.card },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: ui.border },
  modalTitle: { fontSize: 18, fontWeight: "700", color: ui.text },
  modalClose: { fontSize: 20, color: "#9ca3af" },
  modalBody: { padding: 20, gap: 4, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: ui.border, borderRadius: 10, padding: 11, fontSize: 14, color: ui.text, backgroundColor: "#f8faff" },
  textarea: { minHeight: 130 },
  mediaInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  mediaInputField: { flex: 1 },
  uploadMediaBtn: { backgroundColor: "#eef2ff", borderRadius: 9, width: 45, height: 45, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ui.border },
  uploadMediaBtnText: { fontSize: 20 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1.5, borderColor: ui.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: ui.card },
  chipActive: { borderColor: brand.base, backgroundColor: "#eff6ff" },
  chipText: { fontSize: 13, color: ui.textMuted, fontWeight: "500" },
  chipTextActive: { color: brand.base, fontWeight: "700" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
  switchLabel: { fontSize: 14, fontWeight: "600", color: "#334155" },
  saveBtn: { backgroundColor: brand.base, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20, ...shadows.soft },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.7 },
});