import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";

export default function ProductsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, page],
    queryFn: () =>
      api
        .get("/products", { params: { q: search || undefined, page, limit: 20 } })
        .then((r) => r.data.data),
  });

  const products = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search products..."
        value={search}
        onChangeText={(v) => { setSearch(v); setPage(1); }}
      />

      {isLoading ? (
        <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: "/(tabs)/product/[id]" as any, params: { id: item.id } })}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.price}>₹{item.price}</Text>
              <Text style={styles.rating}>★ {item.avgRating?.toFixed(1)} ({item.ratingCount} reviews)</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No products found.</Text>}
        />
      )}

      <View style={styles.pagination}>
        <TouchableOpacity onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          <Text style={[styles.pageBtn, page <= 1 && styles.disabled]}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pageInfo}>Page {page} / {totalPages}</Text>
        <TouchableOpacity onPress={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
          <Text style={[styles.pageBtn, page >= totalPages && styles.disabled]}>Next ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  search: {
    margin: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 10,
    padding: 14,
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: "600", color: "#111827" },
  price: { fontSize: 14, color: "#1a56db", marginTop: 4, fontWeight: "600" },
  rating: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  empty: { textAlign: "center", marginTop: 40, color: "#9ca3af" },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  pageBtn: { color: "#1a56db", fontSize: 16, fontWeight: "600" },
  disabled: { color: "#d1d5db" },
  pageInfo: { color: "#6b7280", fontSize: 14 },
});
