/**
 * My Submissions screen — shows the logged-in user's own products and their approval status.
 * Accessible from Profile tab.
 * File: apps/mobile/app/my-submissions.tsx
 */
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#6b7280",
  SUBMITTED: "#d97706",
  APPROVED: "#059669",
  REJECTED: "#dc2626",
  LOCKED: "#7c3aed",
};

export default function MySubmissionsScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: () =>
      api.get("/products/mine?limit=50").then((r) => r.data.data?.items ?? []),
  });

  if (isLoading) {
    return (
      <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 60 }} />
    );
  }

  const products: any[] = data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Submissions</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/submit-product" as any)}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      {products.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>You haven't submitted any products yet.</Text>
          <Pressable
            style={styles.ctaBtn}
            onPress={() => router.push("/submit-product" as any)}
          >
            <Text style={styles.ctaBtnText}>Submit Your First Product</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: p }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({ pathname: "/(tabs)/product/[id]" as any, params: { id: p.id } })
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.productTitle} numberOfLines={2}>{p.title}</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: STATUS_COLOR[p.status] + "20" },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: STATUS_COLOR[p.status] }]}
                  >
                    {p.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                ₹{p.price}  ·  {p.category}
              </Text>
              {p.approvalReason && p.status === "REJECTED" && (
                <Text style={styles.rejectNote}>Reason: {p.approvalReason}</Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  addBtn: {
    backgroundColor: "#1a56db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { color: "#6b7280", fontSize: 15, textAlign: "center", marginBottom: 20 },
  ctaBtn: {
    backgroundColor: "#1a56db",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  ctaBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 10,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  meta: { fontSize: 13, color: "#6b7280" },
  rejectNote: {
    marginTop: 6,
    fontSize: 12,
    color: "#dc2626",
    fontStyle: "italic",
  },
});
