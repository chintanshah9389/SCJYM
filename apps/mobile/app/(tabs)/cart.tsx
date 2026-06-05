import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { brand, ui, shadows } from "../../lib/theme";

export default function CartScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: cart, isLoading, refetch } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get("/cart").then((r) => r.data.data),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/cart/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const items = cart?.items ?? [];
  const total = items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  if (isLoading) return <ActivityIndicator size="large" color={brand.base} style={{ marginTop: 60 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Cart</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>Your cart is empty.</Text>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.productId}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemPrice}>₹{item.price} × {item.quantity}</Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Remove", "Remove this item?", [
                      { text: "Cancel" },
                      { text: "Remove", onPress: () => removeMutation.mutate(item.productId) },
                    ])
                  }
                >
                  <Text style={styles.remove}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          <View style={styles.footer}>
            <Text style={styles.total}>Total: ₹{total.toFixed(2)}</Text>
            <TouchableOpacity style={styles.checkoutBtn}>
              <Text style={styles.checkoutText}>Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.pageBg, padding: 16, paddingBottom: 92 },
  header: { fontSize: 26, fontWeight: "800", color: ui.text, marginBottom: 16, letterSpacing: 0.2 },
  empty: { textAlign: "center", color: ui.textMuted, marginTop: 40, fontSize: 16 },
  item: {
    flexDirection: "row",
    backgroundColor: ui.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: "700", color: ui.text },
  itemPrice: { fontSize: 13, color: ui.textMuted, marginTop: 4 },
  remove: { fontSize: 20, color: ui.danger, paddingHorizontal: 8, fontWeight: "800" },
  footer: {
    borderTopWidth: 1,
    borderColor: ui.border,
    paddingTop: 16,
    marginTop: 8,
    backgroundColor: ui.pageBg,
  },
  total: { fontSize: 19, fontWeight: "800", color: ui.text, marginBottom: 12 },
  checkoutBtn: {
    backgroundColor: brand.base,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    ...shadows.soft,
  },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
});
