import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { api } from "@/lib/api";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";

export default function CreateMemberPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params: any = useLocalSearchParams();
  const { user } = useAuth();
  const roleOptions = user?.role === "SUPER_ADMIN" ? ["MEMBER", "ADMIN", "SUPER_ADMIN"] : ["MEMBER", "ADMIN"];
  const [form, setForm] = useState<any>({
    fullName: "",
    email: "",
    mobile: "",
    address: { line1: "", line2: "", city: "", state: "", pincode: "", country: "IN" },
    role: "MEMBER",
    status: "APPROVED",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params?.role && roleOptions.includes(params.role)) setForm((s: any) => ({ ...s, role: params.role }));
    if (params?.status) setForm((s: any) => ({ ...s, status: params.status }));
  }, [params?.role, params?.status, roleOptions.join(",")]);

  async function submit() {
    setLoading(true);
    try {
      const res = await api.post("/users", form);
      const pw = res?.data?.data?.password;
      Alert.alert("Created", `User created. Password: ${pw ?? "(not shown)"}`, [
        { text: "OK", onPress: () => { queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "members" }); router.back(); } }
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail?.message ?? err.message ?? "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Member</Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={form.fullName} onChangeText={(v) => setForm((s:any) => ({ ...s, fullName: v }))} placeholder="Full name" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm((s:any) => ({ ...s, email: v }))} keyboardType="email-address" placeholder="Email" />

        <Text style={styles.label}>Mobile</Text>
        <TextInput style={styles.input} value={form.mobile} onChangeText={(v) => setForm((s:any) => ({ ...s, mobile: v }))} keyboardType="phone-pad" placeholder="Mobile" />

        <Text style={styles.label}>Address line 1</Text>
        <TextInput style={styles.input} value={form.address.line1} onChangeText={(v) => setForm((s:any) => ({ ...s, address: { ...s.address, line1: v } }))} placeholder="Address line 1" />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={form.address.city} onChangeText={(v) => setForm((s:any) => ({ ...s, address: { ...s.address, city: v } }))} placeholder="City" />

        <Text style={styles.label}>Role</Text>
        <TouchableOpacity style={styles.input} onPress={() => router.push(`/members/select-role?returnTo=${encodeURIComponent("/members/create")}` as any)}>
          <Text>{form.role}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Status</Text>
        <TouchableOpacity style={styles.input} onPress={() => router.push(`/members/select-status?returnTo=${encodeURIComponent("/members/create")}` as any)}>
          <Text>{form.status}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} secureTextEntry value={form.password} onChangeText={(v) => setForm((s:any) => ({ ...s, password: v }))} placeholder="Leave blank to auto-generate" />

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, marginRight: 12 }}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={submit} style={{ padding: 10 }}>
            <Text style={{ color: "#1a56db" }}>{loading ? "Creating..." : "Create"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f9fafb", flexGrow: 1 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  label: { color: "#374151", marginTop: 8, marginBottom: 6, fontWeight: "600" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", padding: 10, borderRadius: 8, marginBottom: 6 },
});
