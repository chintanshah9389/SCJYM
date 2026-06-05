import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ui, shadows } from "../../lib/theme";

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
  container: { padding: 16, backgroundColor: ui.pageBg, flex: 1 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 12, color: ui.text },
  row: {
    padding: 12,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: ui.card,
    ...shadows.soft,
  },
});
