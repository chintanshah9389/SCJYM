import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";
import { brand, ui, shadows } from "../../lib/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    password: "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function handleReset() {
    setForm({
      fullName: "",
      email: "",
      mobile: "",
      password: "",
      line1: "",
      city: "",
      state: "",
      pincode: "",
    });
    setErrors({});
  }

  function update(key: string) {
    return (val: string) => {
      setForm((f) => ({ ...f, [key]: val }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};
    const { fullName, email, mobile, password, line1, city, state, pincode } = form;

    if (!fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "Enter a valid email address.";

    if (!mobile.trim()) nextErrors.mobile = "Mobile number is required.";
    else if (!/^\d{10}$/.test(mobile.trim())) nextErrors.mobile = "Mobile number must be 10 digits.";

    if (!password.trim()) nextErrors.password = "Password is required.";
    else if (password.trim().length < 6) nextErrors.password = "Password must be at least 6 characters.";

    if (!line1.trim()) nextErrors.line1 = "Address Line 1 is required.";
    if (!city.trim()) nextErrors.city = "City is required.";
    if (!state.trim()) nextErrors.state = "State is required.";
    if (!pincode.trim()) nextErrors.pincode = "Pincode is required.";
    else if (!/^\d{6}$/.test(pincode.trim())) nextErrors.pincode = "Pincode must be 6 digits.";

    return nextErrors;
  }

  async function handleRegister() {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      Alert.alert("Validation Error", "Please correct the highlighted required fields.");
      return;
    }

    const { fullName, email, mobile, password, line1, city, state, pincode } = form;
    setLoading(true);
    try {
      await api.post("/auth/register", {
        fullName,
        email,
        mobile,
        password,
        address: { line1, city, state, pincode },
      });
      Alert.alert(
        "Registration Submitted",
        "Your account is pending admin approval. You will be notified once approved."
      );
      router.replace("/(auth)/login");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ??
        err?.response?.data?.detail?.error?.message ??
        err?.response?.data?.detail?.message ??
        err?.response?.data?.detail ??
        "Registration failed.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  const fields: Array<[string, string, string, boolean?, string?]> = [
    ["fullName", "Full Name", "words"],
    ["email", "Email", "email-address", false, "none"],
    ["mobile", "Mobile (10-digit)", "phone-pad"],
    ["password", "Password", "default", true],
    ["line1", "Address Line 1", "words"],
    ["city", "City", "words"],
    ["state", "State", "words"],
    ["pincode", "Pincode", "numeric"],
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: ui.pageBg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join SCJYGM with your details and start exploring.</Text>
        </View>
        {fields.map(([key, placeholder, kbType, secure, autoCapitalize]) => {
          const hasError = !!errors[key];
          return (
            <View key={key}>
              <Text style={styles.label}>
                {placeholder} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, hasError && styles.inputError]}
                placeholder={placeholder}
                placeholderTextColor="#8ea0d2"
                value={(form as any)[key]}
                onChangeText={update(key)}
                keyboardType={kbType as any}
                secureTextEntry={secure}
                autoCapitalize={(autoCapitalize as any) ?? "sentences"}
              />
              {hasError && <Text style={styles.errorText}>{errors[key]}</Text>}
            </View>
          );
        })}

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Register</Text>
          )}
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset} disabled={loading}>
            <Text style={styles.secondaryBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace("/(auth)/login")}
            disabled={loading}
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 34, paddingBottom: 32 },
  hero: {
    backgroundColor: brand.base,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
    ...shadows.card,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#fff" },
  subtitle: { color: "rgba(255,255,255,0.84)", marginTop: 6, fontSize: 13 },
  label: { color: ui.text, fontWeight: "700", marginBottom: 6, marginTop: 2 },
  required: { color: "#dc2626", fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: ui.card,
    color: ui.text,
    ...shadows.soft,
  },
  inputError: {
    borderColor: "#dc2626",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: -8,
    marginBottom: 10,
    marginLeft: 2,
    fontWeight: "600",
  },
  btn: {
    backgroundColor: brand.base,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginVertical: 16,
    ...shadows.soft,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: -4,
    marginBottom: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: ui.card,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    ...shadows.soft,
  },
  secondaryBtnText: {
    color: ui.text,
    fontSize: 14,
    fontWeight: "700",
  },
  link: { color: brand.base, textAlign: "center", marginTop: 8, fontWeight: "700" },
});
