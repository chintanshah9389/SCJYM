/**
 * Admin: Push Notification Composer + History.
 * File: apps/mobile/app/admin/push-notifications.tsx
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function AdminPushNotificationsScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"compose" | "history">("compose");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [sending, setSending] = useState(false);

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => api.get("/admin/notifications?limit=50").then((r) => r.data.data?.items ?? []),
    enabled: tab === "history",
  });

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Validation", "Title and body are required.");
      return;
    }
    Alert.alert("Send Push", `Broadcast to all users?\n\n"${title}"\n${body}`, [
      { text: "Cancel" },
      {
        text: "Send",
        onPress: async () => {
          setSending(true);
          try {
            console.log("📤 Sending push notification:", { title, body, deepLink });
            const response = await api.post("/admin/notifications/push", {
              title: title.trim(),
              body: body.trim(),
              deepLink: deepLink.trim() || undefined,
            });
            console.log("✅ Push sent successfully:", response.data);
            Alert.alert("Sent!", response.data?.data?.message || "Notification broadcasted to all users.");
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
            Alert.alert("Error", errorMsg);
          } finally {
            setSending(false);
          }
        },
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
        histLoading ? (
          <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={history ?? []}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ padding: 12 }}
            ListEmptyComponent={<Text style={styles.empty}>No notifications sent yet.</Text>}
            renderItem={({ item: n }) => (
              <View style={styles.histCard}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifBody}>{n.body}</Text>
                <Text style={styles.notifDate}>{new Date(n.createdAt).toLocaleString()}</Text>
              </View>
            )}
          />
        )
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
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827" },
  textarea: { height: 110 },
  hint: { fontSize: 13, color: "#6b7280", marginTop: 16, lineHeight: 20 },
  sendBtn: { backgroundColor: "#1a56db", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  sendBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  empty: { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 15 },
  histCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 10, elevation: 1 },
  notifTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 4 },
  notifBody: { fontSize: 13, color: "#374151", marginBottom: 6 },
  notifDate: { fontSize: 12, color: "#9ca3af" },
});
