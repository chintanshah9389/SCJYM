/**
 * Admin: Push Notification Composer + History.
 * File: apps/mobile/app/admin/push-notifications.tsx
 */
import React, { useState } from "react";
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

export default function AdminPushNotificationsScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"compose" | "history">("compose");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => api.get("/admin/notifications?limit=50").then((r) => r.data.data?.items ?? []),
    enabled: tab === "history",
  });

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
      console.log("📤 Sending push notification:", { title, body, deepLink });
      const response = await api.post("/admin/notifications/push", {
        title: title.trim(),
        body: body.trim(),
        deepLink: deepLink.trim() || undefined,
      });
      console.log("✅ Push sent successfully:", response.data);
      const payload = response.data?.data || {};
      const msg = payload?.message || "Notification broadcasted to all users.";
      const approvedUsers = payload?.approvedUsers ?? 0;
      const usersWithToken = payload?.usersWithToken ?? 0;
      const usersWithoutToken = payload?.usersWithoutToken ?? 0;
      const details = `Approved users: ${approvedUsers}\nWith token: ${usersWithToken}\nWithout token: ${usersWithoutToken}`;
      setStatusMsg(`✅ ${msg}\n${details}`);
      Alert.alert("Success", `${msg}\n\n${details}`);
      setTitle("");
      setBody("");
      setDeepLink("");
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

    if (Platform.OS === "web") {
      const confirmed = window.confirm(`Broadcast to all users?\n\n"${title}"\n${body}`);
      if (!confirmed) return;
      await doSendPush();
      return;
    }

    Alert.alert("Send Push", `Broadcast to all users?\n\n"${title}"\n${body}`, [
      { text: "Cancel" },
      {
        text: "Send",
        onPress: doSendPush,
      },
    ]);
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

          <Text style={styles.hint}>📡 This will be sent to ALL registered users with notifications enabled.</Text>

          <Pressable style={[styles.sendBtn, sending && styles.disabled]} onPress={handleSend} disabled={sending}>
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>🔔 Broadcast to All Users</Text>
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
            <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 40 }} />
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
  container: { flex: 1, backgroundColor: "#f9fafb" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e5e7eb" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderColor: "#1a56db" },
  tabText: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  tabTextActive: { color: "#1a56db" },
  form: { padding: 20 },
  statusBox: { backgroundColor: "#f0f9ff", borderWidth: 1, borderColor: "#93c5fd", borderRadius: 8, padding: 12, marginBottom: 16 },
  statusText: { fontSize: 13, color: "#1e40af", fontWeight: "500" },
  testBtn: { backgroundColor: "#10b981", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginBottom: 20 },
  testBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827" },
  textarea: { height: 110 },
  hint: { fontSize: 13, color: "#6b7280", marginTop: 16, lineHeight: 20 },
  sendBtn: { backgroundColor: "#1a56db", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  sendBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  historyActions: {
    paddingHorizontal: 12,
    paddingTop: 10,
    alignItems: "flex-end",
  },
  clearAllBtn: {
    backgroundColor: "#991b1b",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearAllBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  empty: { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 15 },
  histCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 10, elevation: 1, position: "relative" },
  notifTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 4 },
  notifBody: { fontSize: 13, color: "#374151", marginBottom: 6 },
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
