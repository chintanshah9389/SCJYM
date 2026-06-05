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
  const [loading, setLoading] = useState(false);

  function update(key: string) {
    return (val: string) => setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleRegister() {
    const { fullName, email, mobile, password, line1, city, state, pincode } = form;
    if (!fullName || !email || !mobile || !password || !line1 || !city || !state || !pincode) {
      Alert.alert("Error", "All fields are required.");
      return;
    }
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
        "Your account is pending admin approval. You will be notified once approved.",
        [{ text: "OK", onPress: () => router.push("/(auth)/login") }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Registration failed.";
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
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Create Account</Text>
        {fields.map(([key, placeholder, kbType, secure, autoCapitalize]) => (
          <TextInput
            key={key}
            style={styles.input}
            placeholder={placeholder}
            value={(form as any)[key]}
            onChangeText={update(key)}
            keyboardType={kbType as any}
            secureTextEntry={secure}
            autoCapitalize={(autoCapitalize as any) ?? "sentences"}
          />
        ))}

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: "bold", color: "#1a56db", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#1a56db",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginVertical: 16,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#1a56db", textAlign: "center", marginTop: 8 },
});
