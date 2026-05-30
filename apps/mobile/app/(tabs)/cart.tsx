import React from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export default function CartScreen() {
  const qc = useQueryClient();

  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get("/cart").then((r) => r.data.data),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/cart/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const items = cart?.items ?? [];
  const total = items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);

  if (isLoading) return <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 60 }} />;

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
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  header: { fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 16 },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40, fontSize: 16 },
  item: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    elevation: 2,
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  itemPrice: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  remove: { fontSize: 18, color: "#ef4444", paddingHorizontal: 8 },
  footer: { borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 16, marginTop: 8 },
  total: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 12 },
  checkoutBtn: {
    backgroundColor: "#1a56db",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
