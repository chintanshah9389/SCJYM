import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "../../../lib/theme";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params: any = useLocalSearchParams();
  const id = params?.id;
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await api.patch(`/users/${id}/password`, { newPassword: password });
      Alert.alert("Success", "Password updated", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail?.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Set a secure new password for this member account.</Text>
      </View>
      <Text style={styles.label}>New password</Text>
      <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="New password" />

      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 20 }}>
        <TouchableOpacity onPress={submit} style={{ padding: 10 }}>
          <Text style={{ color: brand.base, fontWeight: "700" }}>{loading ? "Updating..." : "Update Password"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: ui.pageBg, flex: 1 },
  hero: {
    backgroundColor: brand.base,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    ...shadows.card,
  },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 4, color: "#fff" },
  subtitle: { color: "rgba(255,255,255,0.86)", fontSize: 12 },
  label: { color: "#334155", marginTop: 8, marginBottom: 6, fontWeight: "700" },
  input: { backgroundColor: ui.card, borderWidth: 1, borderColor: ui.border, padding: 10, borderRadius: 10, color: ui.text },
});
