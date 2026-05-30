import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  async function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.card}>
        <Row label="Name" value={user?.fullName ?? ""} />
        <Row label="Email" value={user?.email ?? ""} />
        <Row label="Role" value={user?.role ?? ""} />
        <Row label="Status" value={user?.status ?? ""} />
      </View>

      {/* Admin section */}
      {isAdmin && (
        <TouchableOpacity
          style={[styles.btn, styles.admin]}
          onPress={() => router.push("/admin/index" as any)}
        >
          <Text style={styles.btnText}>🛡️ Admin Panel</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push("/notifications" as any)}
      >
        <Text style={styles.btnText}>🔔 Notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.submit]}
        onPress={() => router.push("/submit-product" as any)}
      >
        <Text style={styles.btnText}>📦 Submit a Product</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.myItems]}
        onPress={() => router.push("/my-submissions" as any)}
      >
        <Text style={styles.btnText}>📋 My Submissions</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.danger]} onPress={handleLogout}>
        <Text style={styles.btnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 20 },
  header: { fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 24, elevation: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  label: { color: "#6b7280", fontSize: 14 },
  value: { color: "#111827", fontSize: 14, fontWeight: "500" },
  btn: { backgroundColor: "#1a56db", borderRadius: 8, padding: 14, alignItems: "center", marginBottom: 12 },
  admin: { backgroundColor: "#7c3aed" },
  submit: { backgroundColor: "#059669" },
  myItems: { backgroundColor: "#0891b2" },
  danger: { backgroundColor: "#ef4444" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
