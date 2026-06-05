import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { brand, ui, shadows } from "../../lib/theme";
import BrandMark from "../../components/BrandMark";

export default function LoginScreen() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function validateForm() {
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Password is required.";
    return nextErrors;
  }

  async function handleLogin() {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast("Please correct the highlighted required fields.", "warning");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      showToast("Login successful", "success");
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ??
        err?.response?.data?.detail?.error?.message ??
        err?.response?.data?.detail?.message ??
        err?.response?.data?.detail ??
        "Login failed. Please check your email and password.";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={brand.base} />

      {/* Hero / Splash Header */}
      <LinearGradient
        colors={brand.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroFoldLeft} />
        <View style={styles.heroFoldRight} />
        <View style={styles.heroFoldTop} />
        <Image source={require("../../assets/icon.png")} style={styles.logoImage} resizeMode="contain" />
        <BrandMark size={110} light style={styles.logoMark} />
        <Text style={styles.appName}>SCJYGM</Text>
        <Text style={styles.tagline}>Secure flow. Smart rewards. Fast trust.</Text>
      </LinearGradient>

      {/* Card */}
      <KeyboardAvoidingView
        style={styles.cardWrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0}
      >
        <ScrollView
          contentContainerStyle={styles.card}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Sign in to continue</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Email <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="you@example.com"
              placeholderTextColor="#9ca3af"
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
              autoComplete="email"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Password <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.password;
                      return next;
                    });
                  }
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
              >
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotWrap}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.registerText}>Create an account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const BLUE = brand.base;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLUE },

  /* ── Hero ── */
  hero: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 28,
    overflow: "hidden",
    position: "relative",
  },
  heroFoldLeft: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    left: 26,
    top: 34,
    transform: [{ rotate: "-18deg" }],
  },
  heroFoldRight: {
    position: "absolute",
    width: 126,
    height: 126,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    right: 34,
    top: 42,
    transform: [{ rotate: "24deg" }],
  },
  heroFoldTop: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "rgba(255,154,95,0.56)",
    top: 20,
    right: 72,
    transform: [{ rotate: "45deg" }],
  },
  logoMark: {
    marginBottom: 10,
    marginTop: -2,
  },
  logoImage: {
    width: 78,
    height: 78,
    marginBottom: 10,
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1.4,
  },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.84)", marginTop: 4, letterSpacing: 0.45 },

  /* ── Card ── */
  cardWrapper: { flex: 1 },
  card: {
    backgroundColor: ui.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 28,
    paddingBottom: 40,
    minHeight: 420,
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  cardTitle: { fontSize: 25, fontWeight: "800", color: ui.text, marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: ui.textMuted, marginBottom: 24 },

  /* ── Inputs ── */
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: ui.textMuted, marginBottom: 6 },
  required: { color: "#dc2626", fontWeight: "800" },
  input: {
    borderWidth: 1.5,
    borderColor: ui.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: ui.text,
    backgroundColor: "#fffafa",
  },
  inputError: {
    borderColor: "#dc2626",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
    fontWeight: "600",
  },
  passwordRow: { position: "relative" },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  eyeText: { fontSize: 18 },

  forgotWrap: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: BLUE, fontWeight: "500" },

  /* ── Buttons ── */
  btn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    ...shadows.soft,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: ui.border },
  dividerText: { marginHorizontal: 12, color: "#b17c82", fontSize: 13 },

  registerBtn: {
    borderWidth: 1.5,
    borderColor: BLUE,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    backgroundColor: brand.tint,
  },
  registerText: { color: BLUE, fontSize: 15, fontWeight: "600" },
});
