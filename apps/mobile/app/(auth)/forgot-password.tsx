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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validateForm() {
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    return nextErrors;
  }

  async function handleSubmit() {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      Alert.alert("Validation Error", "Please correct the highlighted required fields.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      Alert.alert(
        "Email Sent",
        "If that email exists, a password reset link has been sent.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
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
      <Text style={styles.label}>
        Email <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="Email"
        placeholderTextColor="#8ea0d2"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (errors.email) {
            setErrors((prev) => {
              const next = { ...prev };
              delete next.email;
              return next;
            });
          }
        }}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
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
  label: { color: ui.text, fontWeight: "700", marginBottom: 6 },
  required: { color: "#dc2626", fontWeight: "800" },
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
  inputError: { borderColor: "#dc2626" },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 2,
    fontWeight: "600",
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
