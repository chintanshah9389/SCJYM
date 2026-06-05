import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "expo-router";
import { brand, ui, shadows } from "../../lib/theme";

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
          try {
            await logout();
          } catch {
            // Root auth guard will handle redirect after session is cleared.
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.header}>Profile</Text>
        <Text style={styles.heroSub}>Your account, preferences, and quick actions in one place.</Text>
      </View>

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
  container: { flex: 1, backgroundColor: ui.pageBg },
  content: { padding: 20, paddingBottom: 96 },
  hero: {
    backgroundColor: brand.base,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  header: { fontSize: 26, fontWeight: "800", color: "#fff" },
  heroSub: { marginTop: 6, color: "rgba(255,255,255,0.86)", fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: ui.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#edf1ff" },
  label: { color: ui.textMuted, fontSize: 14, fontWeight: "600" },
  value: { color: ui.text, fontSize: 14, fontWeight: "700" },
  btn: { backgroundColor: brand.base, borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 12, ...shadows.soft },
  admin: { backgroundColor: brand.deep },
  submit: { backgroundColor: ui.success },
  myItems: { backgroundColor: ui.info },
  danger: { backgroundColor: ui.danger },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
});
