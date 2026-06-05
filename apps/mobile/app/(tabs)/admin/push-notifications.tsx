/**
 * Admin: Push Notification Composer + History.
 * File: apps/mobile/app/admin/push-notifications.tsx
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "@/lib/theme";

type AdminUser = {
  id: string;
  fullName?: string;
  email?: string;
  status?: string;
};

export default function AdminPushNotificationsScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"compose" | "history">("compose");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => api.get("/admin/notifications?limit=50").then((r) => r.data.data?.items ?? []),
    enabled: tab === "history",
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-notification-users"],
    queryFn: () =>
      api
        .get("/users?status=APPROVED&limit=100")
        .then((r) => r.data.data?.items ?? []),
    enabled: tab === "compose",
    staleTime: 60_000,
  });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.fullName ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, userSearch]);

  const deleteNotification = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const deleteAllNotifications = useMutation({
    mutationFn: () => api.delete("/admin/notifications"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  async function doSendPush() {
    setSending(true);
    setStatusMsg("Sending...");
    try {
      const targetUserIds = Array.from(selectedUserIds);
      console.log("📤 Sending push notification:", { title, body, deepLink, targetUserIds });
      const response = await api.post("/admin/notifications/push", {
        title: title.trim(),
        body: body.trim(),
        deepLink: deepLink.trim() || undefined,
        targetUserIds,
      });
      console.log("✅ Push sent successfully:", response.data);
      const payload = response.data?.data || {};
      const msg = payload?.message || "Notification sent.";
      const usersWithToken = payload?.usersWithToken ?? 0;
      const usersWithoutToken = payload?.usersWithoutToken ?? 0;
      const targetedUsers = payload?.targetedUsers ?? 0;
      const details = `Selected users: ${targetedUsers}\nWith token: ${usersWithToken}\nWithout token: ${usersWithoutToken}`;
      setStatusMsg(`✅ ${msg}\n${details}`);
      Alert.alert("Success", `${msg}\n\n${details}`);
      setTitle("");
      setBody("");
      setDeepLink("");
      setSelectedUserIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    } catch (e: any) {
      console.error("❌ Push send failed:", {
        status: e?.response?.status,
        error: e?.response?.data,
        message: e?.message,
      });
      const errorMsg = e?.response?.data?.error?.message || e?.message || "Failed to send notification.";
      setStatusMsg(`❌ Error: ${errorMsg}`);
      Alert.alert("Error", errorMsg);
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Validation", "Title and body are required.");
      return;
    }

    if (selectedUserIds.size === 0) {
      Alert.alert("Validation", "Select at least one user.");
      return;
    }

    const targetSummary = `Send to ${selectedUserIds.size} selected user(s)?`;

    if (Platform.OS === "web") {
      const confirmed = window.confirm(`${targetSummary}\n\n"${title}"\n${body}`);
      if (!confirmed) return;
      await doSendPush();
      return;
    }

    Alert.alert("Send Push", `${targetSummary}\n\n"${title}"\n${body}`, [
      { text: "Cancel" },
      {
        text: "Send",
        onPress: doSendPush,
      },
    ]);
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function testConnection() {
    setStatusMsg("Testing connection...");
    try {
      const response = await api.get("/users/me");
      console.log("✅ Connected to API:", response.data);
      setStatusMsg(`✅ API Connected. User: ${response.data?.data?.email}`);
      Alert.alert("Connected", `API is reachable.\nUser: ${response.data?.data?.email}`);
    } catch (e: any) {
      console.error("❌ Connection failed:", e?.message);
      const msg = e?.message || "Cannot reach API";
      setStatusMsg(`❌ ${msg}`);
      Alert.alert("Connection Error", msg);
    }
  }

  function confirmDelete(id: string) {
    if (Platform.OS === "web") {
      const ok = window.confirm("Delete this notification permanently?");
      if (!ok) return;
      deleteNotification.mutate(id);
      return;
    }

    Alert.alert("Delete Notification", "Delete this notification permanently?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteNotification.mutate(id),
      },
    ]);
  }

  function confirmDeleteAll() {
    if (Platform.OS === "web") {
      const ok = window.confirm("Delete all notification history permanently?");
      if (!ok) return;
      deleteAllNotifications.mutate();
      return;
    }

    Alert.alert("Delete All Notifications", "Delete all notification history permanently?", [
      { text: "Cancel" },
      {
        text: "Delete All",
        style: "destructive",
        onPress: () => deleteAllNotifications.mutate(),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === "compose" && styles.tabActive]} onPress={() => setTab("compose")}>
          <Text style={[styles.tabText, tab === "compose" && styles.tabTextActive]}>Compose</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "history" && styles.tabActive]} onPress={() => setTab("history")}>
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>History</Text>
        </Pressable>
      </View>

      {tab === "compose" ? (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {statusMsg && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMsg}</Text>
            </View>
          )}

          <Pressable style={[styles.testBtn]} onPress={testConnection}>
            <Text style={styles.testBtnText}>🔗 Test API Connection</Text>
          </Pressable>

          <Text style={styles.label}>Notification Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., New Products Available!"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Body *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={body}
            onChangeText={setBody}
            placeholder="Notification message..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Deep Link (optional)</Text>
          <TextInput
            style={styles.input}
            value={deepLink}
            onChangeText={setDeepLink}
            placeholder="e.g. /(tabs)/notifications or /(tabs)/product/123"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Target Users</Text>
          <View style={styles.userSelectWrap}>
            <TextInput
              style={styles.input}
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Search user by name/email"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.selectedCount}>Selected: {selectedUserIds.size}</Text>

            {usersLoading ? (
              <ActivityIndicator size="small" color={brand.base} style={{ marginTop: 8 }} />
            ) : (
              <View style={styles.userListBox}>
                {filteredUsers.slice(0, 50).map((u) => {
                  const selected = selectedUserIds.has(u.id);
                  return (
                    <Pressable key={u.id} style={styles.userRow} onPress={() => toggleUserSelection(u.id)}>
                      <View style={[styles.checkbox, selected && styles.checkboxChecked]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{u.fullName || "Unnamed"}</Text>
                        <Text style={styles.userEmail}>{u.email || "-"}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {filteredUsers.length === 0 && <Text style={styles.emptyUsers}>No users found.</Text>}
              </View>
            )}
          </View>

          <Text style={styles.hint}>📡 This will be sent only to selected users.</Text>

          <Pressable style={[styles.sendBtn, sending && styles.disabled]} onPress={handleSend} disabled={sending}>
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>{`🔔 Send to Selected (${selectedUserIds.size})`}</Text>
            )}
          </Pressable>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.historyActions}>
            <Pressable
              style={[styles.clearAllBtn, deleteAllNotifications.isPending && styles.disabled]}
              onPress={confirmDeleteAll}
              disabled={deleteAllNotifications.isPending}
            >
              <Text style={styles.clearAllBtnText}>Delete All History</Text>
            </Pressable>
          </View>

          {histLoading ? (
            <ActivityIndicator size="large" color={brand.base} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={history ?? []}
              keyExtractor={(n) => n.id}
              contentContainerStyle={{ padding: 12 }}
              ListEmptyComponent={<Text style={styles.empty}>No notifications sent yet.</Text>}
              renderItem={({ item: n }) => (
                <View style={styles.histCard}>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => confirmDelete(n.id)}
                    disabled={deleteNotification.isPending}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  <Text style={styles.notifBody}>{n.body}</Text>
                  <Text style={styles.notifDate}>{new Date(n.createdAt).toLocaleString()}</Text>
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.pageBg },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: ui.border, backgroundColor: ui.card },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderColor: brand.base },
  tabText: { fontSize: 14, color: ui.textMuted, fontWeight: "600" },
  tabTextActive: { color: brand.base },
  form: { padding: 20 },
  statusBox: { backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 10, padding: 12, marginBottom: 16 },
  statusText: { fontSize: 13, color: "#1e40af", fontWeight: "500" },
  testBtn: { backgroundColor: "#0f766e", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginBottom: 20, ...shadows.soft },
  testBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: ui.card, borderWidth: 1, borderColor: ui.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: ui.text },
  textarea: { height: 110 },
  userSelectWrap: { marginTop: 10 },
  selectedCount: { marginTop: 8, fontSize: 12, color: "#334155", fontWeight: "700" },
  userListBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 10,
    backgroundColor: ui.card,
    maxHeight: 220,
    paddingVertical: 4,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#9ca3af",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    borderColor: brand.base,
    backgroundColor: brand.base,
  },
  userName: { fontSize: 13, fontWeight: "600", color: ui.text },
  userEmail: { fontSize: 12, color: ui.textMuted },
  emptyUsers: { textAlign: "center", color: ui.textMuted, paddingVertical: 12 },
  hint: { fontSize: 13, color: ui.textMuted, marginTop: 16, lineHeight: 20 },
  sendBtn: { backgroundColor: brand.base, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 24, ...shadows.soft },
  sendBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  historyActions: {
    paddingHorizontal: 12,
    paddingTop: 10,
    alignItems: "flex-end",
  },
  clearAllBtn: {
    backgroundColor: "#b91c1c",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearAllBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  empty: { textAlign: "center", marginTop: 60, color: ui.textMuted, fontSize: 15 },
  histCard: { backgroundColor: ui.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: ui.border, position: "relative", ...shadows.soft },
  notifTitle: { fontSize: 15, fontWeight: "700", color: ui.text, marginBottom: 4 },
  notifBody: { fontSize: 13, color: "#334155", marginBottom: 6 },
  notifDate: { fontSize: 12, color: "#9ca3af" },
  deleteBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#fee2e2",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
});
