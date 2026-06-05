import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";
import { brand, ui, shadows } from "../../lib/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      Alert.alert(
        "Email Sent",
        "If that email exists, a password reset link has been sent.",
        [{ text: "OK", onPress: () => router.push("/(auth)/login") }]
      );
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a reset link.
        </Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#8ea0d2"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Send Reset Link</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Back to Sign In</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: ui.pageBg },
  card: {
    backgroundColor: ui.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  title: { fontSize: 28, fontWeight: "800", color: brand.base, marginBottom: 8 },
  subtitle: { color: ui.textMuted, marginBottom: 24, lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#f8faff",
    color: ui.text,
  },
  btn: {
    backgroundColor: brand.base,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
    ...shadows.soft,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  link: { color: brand.base, textAlign: "center", fontWeight: "700" },
});
