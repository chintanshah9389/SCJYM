import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";

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
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.label}>New password</Text>
      <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="New password" />

      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, marginRight: 12 }}>
          <Text>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={submit} style={{ padding: 10 }}>
          <Text style={{ color: "#1a56db" }}>{loading ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f9fafb", flex: 1 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  label: { color: "#374151", marginTop: 8, marginBottom: 6, fontWeight: "600" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", padding: 10, borderRadius: 8 },
});
