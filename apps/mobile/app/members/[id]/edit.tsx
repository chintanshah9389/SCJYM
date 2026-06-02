import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export default function EditMemberPage() {
  const router = useRouter();
  const params: any = useLocalSearchParams();
  const id = params?.id;
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  const ROLES = ["MEMBER", "ADMIN", "SUPER_ADMIN"];
  const STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "SUSPENDED"];

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setPassword("");
    setShowPassword(false);
    (async () => {
      try {
        const res = await api.get(`/users/${id}`);
        if (mounted) setForm(res.data.data);
      } catch (err: any) {
        Alert.alert("Error", "Failed to fetch user");
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (!form) return;
    if (params?.role) setForm((s: any) => ({ ...s, role: params.role }));
    if (params?.status) setForm((s: any) => ({ ...s, status: params.status }));
  }, [params?.role, params?.status]);

  async function submit() {
    setLoading(true);
    try {
      await api.patch(`/users/${id}`, form);
      if (password && password.trim().length > 0) {
        await api.patch(`/users/${id}/password`, { newPassword: password.trim() });
      }
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "members" });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail?.message ?? "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  if (!form) return (<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator /></View>);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Edit Member</Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={form.fullName} onChangeText={(v) => setForm((s:any) => ({ ...s, fullName: v }))} placeholder="Full name" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm((s:any) => ({ ...s, email: v }))} keyboardType="email-address" placeholder="Email" />

        <Text style={styles.label}>Mobile</Text>
        <TextInput style={styles.input} value={form.mobile} onChangeText={(v) => setForm((s:any) => ({ ...s, mobile: v }))} keyboardType="phone-pad" placeholder="Mobile" />

        <Text style={styles.label}>Role</Text>
        <TouchableOpacity style={styles.input} onPress={() => { setShowRoleMenu((s) => !s); setShowStatusMenu(false); }}>
          <Text>{form.role}</Text>
        </TouchableOpacity>
        {showRoleMenu && (
          <View style={styles.dropdownContainerInline}>
            {ROLES.map((r) => (
              <TouchableOpacity key={r} onPress={() => { setForm((s: any) => ({ ...s, role: r })); setShowRoleMenu(false); }} style={styles.dropdownItemInline}>
                <Text style={form.role === r ? styles.dropdownSelected : undefined}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Status</Text>
        <TouchableOpacity style={styles.input} onPress={() => { setShowStatusMenu((s) => !s); setShowRoleMenu(false); }}>
          <Text>{form.status}</Text>
        </TouchableOpacity>
        {showStatusMenu && (
          <View style={styles.dropdownContainerInline}>
            {STATUSES.map((s) => (
              <TouchableOpacity key={s} onPress={() => { setForm((f: any) => ({ ...f, status: s })); setShowStatusMenu(false); }} style={styles.dropdownItemInline}>
                <Text style={form.status === s ? styles.dropdownSelected : undefined}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter new password for this member"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
        />
        <Text style={styles.hint}>Current password cannot be viewed. Enter a new password only if you want to change it.</Text>
        <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={{ alignSelf: "flex-end", marginBottom: 6 }}>
          <Text style={{ color: "#1a56db", fontWeight: "600" }}>{showPassword ? "Hide" : "Show"}</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, marginRight: 12 }}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={submit} style={{ padding: 10 }}>
            <Text style={{ color: "#1a56db" }}>{loading ? "Saving..." : "Save"}</Text>
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
  hint: { color: "#6b7280", fontSize: 12, marginBottom: 8 },
  dropdownContainerInline: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, marginHorizontal: 12, marginBottom: 8, overflow: "hidden" },
  dropdownItemInline: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  dropdownSelected: { color: "#1a56db", fontWeight: "700" },
});
