import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";
import { brand, ui, shadows } from "../../lib/theme";

export default function ProductsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["products", search, page],
    queryFn: () =>
      api
        .get("/products", { params: { q: search || undefined, page, limit: 20 } })
        .then((r) => r.data.data),
  });

  const products = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search products..."
        placeholderTextColor="#8ea0d2"
        value={search}
        onChangeText={(v) => { setSearch(v); setPage(1); }}
      />

      {isLoading ? (
        <ActivityIndicator size="large" color={brand.base} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: "/(tabs)/product/[id]" as any, params: { id: item.id } })}
            >
              {item.images && item.images.length > 0 ? (
                <Image source={{ uri: item.images[0] }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                  <Text style={styles.cardImagePlaceholderText}>No Image</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.price}>₹{item.price}</Text>
                <Text style={styles.rating}>★ {item.avgRating?.toFixed(1)} ({item.ratingCount} reviews)</Text>
              </View>
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
  container: { flex: 1, backgroundColor: ui.pageBg },
  search: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: ui.card,
    fontSize: 15,
    color: ui.text,
    ...shadows.soft,
  },
  card: {
    backgroundColor: ui.card,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  cardImage: { width: "100%", height: 180 },
  cardImagePlaceholder: { backgroundColor: "#e8eeff", alignItems: "center", justifyContent: "center" },
  cardImagePlaceholderText: { color: "#8093c4", fontSize: 13, fontWeight: "600" },
  cardBody: { padding: 14 },
  title: { fontSize: 16, fontWeight: "700", color: ui.text },
  price: { fontSize: 15, color: brand.base, marginTop: 6, fontWeight: "800" },
  rating: { fontSize: 12, color: ui.textMuted, marginTop: 4 },
  empty: { textAlign: "center", marginTop: 40, color: ui.textMuted },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  pageBtn: { color: brand.base, fontSize: 16, fontWeight: "700" },
  disabled: { color: "#b5c1e0" },
  pageInfo: { color: ui.textMuted, fontSize: 14, fontWeight: "600" },
});
