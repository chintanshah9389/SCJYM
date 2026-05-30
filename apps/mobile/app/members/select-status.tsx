import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

const STATUSES = ["PENDING", "APPROVED", "SUSPENDED"];

export default function SelectStatusPage() {
  const router = useRouter();
  const params: any = useLocalSearchParams();
  const returnTo = params?.returnTo ?? "/members";

  function choose(s: string) {
    const sep = returnTo.includes("?") ? "&" : "?";
    router.replace((returnTo + sep + `status=${encodeURIComponent(s)}`) as any);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Status</Text>
      {STATUSES.map((s) => (
        <TouchableOpacity key={s} onPress={() => choose(s)} style={styles.row}>
          <Text>{s}</Text>
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
