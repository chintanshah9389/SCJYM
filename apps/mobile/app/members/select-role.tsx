import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function SelectRolePage() {
  const router = useRouter();
  const params: any = useLocalSearchParams();
  const { user } = useAuth();
  const ROLES = user?.role === "SUPER_ADMIN" ? ["MEMBER", "ADMIN", "SUPER_ADMIN"] : ["MEMBER", "ADMIN"];
  const returnTo = params?.returnTo ?? "/members";

  function choose(r: string) {
    const sep = returnTo.includes("?") ? "&" : "?";
    router.replace((returnTo + sep + `role=${encodeURIComponent(r)}`) as any);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Role</Text>
      {ROLES.map((r) => (
        <TouchableOpacity key={r} onPress={() => choose(r)} style={styles.row}>
          <Text>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff", flex: 1 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  row: { padding: 12, borderBottomWidth: 1, borderColor: "#eee" },
});
