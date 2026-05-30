import React from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export default function NotificationsScreen() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = data?.items ?? [];

  if (isLoading) return <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 60 }} />;

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <Text style={styles.empty}>No notifications yet.</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, !item.read && styles.unread]}
              onPress={() => !item.read && markRead.mutate(item.id)}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  empty: { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 16 },
  item: { backgroundColor: "#fff", margin: 8, borderRadius: 10, padding: 14, elevation: 1 },
  unread: { borderLeftWidth: 4, borderLeftColor: "#1a56db" },
  title: { fontSize: 15, fontWeight: "600", color: "#111827" },
  body: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  time: { fontSize: 11, color: "#9ca3af", marginTop: 6 },
});
