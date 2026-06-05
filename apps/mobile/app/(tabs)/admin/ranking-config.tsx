/**
 * Admin: Ranking & Best Sellers configuration.
 * File: apps/mobile/app/admin/ranking-config.tsx
 */
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "@/lib/theme";

interface RankingConfig {
  priorStrength: number;
  minRatingCountForEligibility: number;
  minAvgRatingForEligibility: number;
  globalMeanRating: number;
  weightSales: number;
  weightRating: number;
  weightRatingVolume: number;
  weightRecency: number;
  regionLevel: string;
  minRegionProductCount: number;
  personalizationEnabled: boolean;
  affinityWeightBase: number;
  affinityWeightPersonal: number;
  affinityIncrementView: number;
  affinityIncrementAddToCart: number;
  affinityIncrementPurchase: number;
  affinityIncrementRate: number;
  decayFactor: number;
  explorationPercentage: number;
  categoryDiversityLimit: number;
  topN: number;
}

export default function RankingConfigScreen() {
  const qc = useQueryClient();
  const [form, setForm] = useState<RankingConfig | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-ranking-config"],
    queryFn: () => api.get("/admin/ranking-config").then((r) => r.data.data),
  });

  useEffect(() => {
    if (config && !form) setForm(config);
  }, [config]);

  const saveMut = useMutation({
    mutationFn: (data: Partial<RankingConfig>) => api.put("/admin/ranking-config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ranking-config"] });
      Alert.alert("Saved", "Ranking config updated successfully.");
    },
    onError: (e: any) => Alert.alert("Error", e?.response?.data?.error?.message ?? "Save failed"),
  });

  if (isLoading || !form) {
    return <ActivityIndicator size="large" color={brand.base} style={{ marginTop: 60 }} />;
  }

  function num(key: keyof RankingConfig, v: string) {
    setForm((f) => f ? ({ ...f, [key]: parseFloat(v) || 0 }) : f);
  }

  function handleSave() {
    if (!form) return;
    const weights = [form.weightSales, form.weightRating, form.weightRatingVolume, form.weightRecency];
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      Alert.alert("Validation", `Best Seller weights must sum to 1.0 (current: ${sum.toFixed(3)})`);
      return;
    }
    saveMut.mutate(form);
  }

  function Field({ label, field, step = "0.01", editable = true }: { label: string; field: keyof RankingConfig; step?: string; editable?: boolean }) {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          value={String((form as any)[field] ?? "")}
          onChangeText={(v) => num(field, v)}
          keyboardType="decimal-pad"
          editable={editable}
          placeholderTextColor="#9ca3af"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Bayesian Section */}
        <Text style={styles.section}>📊 Bayesian Rating</Text>
        <View style={styles.row2}>
          <Field label="Prior Strength (m)" field="priorStrength" step="1" />
          <Field label="Min Rating Count" field="minRatingCountForEligibility" step="1" />
        </View>
        <View style={styles.row2}>
          <Field label="Min Avg Rating" field="minAvgRatingForEligibility" />
          <Field label="Global Mean C (read-only)" field="globalMeanRating" editable={false} />
        </View>

        {/* Best Seller Weights */}
        <Text style={styles.section}>⚖️ Best Seller Weights (sum = 1.0)</Text>
        <View style={styles.row2}>
          <Field label="🛒 Sales" field="weightSales" />
          <Field label="⭐ Rating" field="weightRating" />
        </View>
        <View style={styles.row2}>
          <Field label="📊 Rating Volume" field="weightRatingVolume" />
          <Field label="🕐 Recency" field="weightRecency" />
        </View>
        <Text style={styles.hint}>
          Sum:{" "}
          {(form.weightSales + form.weightRating + form.weightRatingVolume + form.weightRecency).toFixed(3)}
        </Text>

        {/* Region */}
        <Text style={styles.section}>🗺️ Region</Text>
        <Text style={styles.fieldLabel}>Region Level</Text>
        <View style={styles.chipRow}>
          {["CITY", "STATE", "PINCODE"].map((r) => (
            <Pressable
              key={r}
              style={[styles.chip, form.regionLevel === r && styles.chipActive]}
              onPress={() => setForm((f) => f ? ({ ...f, regionLevel: r }) : f)}
            >
              <Text style={[styles.chipText, form.regionLevel === r && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Min Region Product Count" field="minRegionProductCount" step="1" />

        {/* Personalization */}
        <Text style={styles.section}>✨ Personalization</Text>
        <View style={styles.switchRow}>
          <Text style={styles.fieldLabel}>Personalization Enabled</Text>
          <Switch
            value={form.personalizationEnabled}
            onValueChange={(v) => setForm((f) => f ? ({ ...f, personalizationEnabled: v }) : f)}
            trackColor={{ true: brand.base }}
          />
        </View>
        <View style={styles.row2}>
          <Field label="Affinity Base Weight" field="affinityWeightBase" />
          <Field label="Affinity Personal Weight" field="affinityWeightPersonal" />
        </View>
        <View style={styles.row2}>
          <Field label="Increment: View" field="affinityIncrementView" />
          <Field label="Increment: Cart" field="affinityIncrementAddToCart" />
        </View>
        <View style={styles.row2}>
          <Field label="Increment: Purchase" field="affinityIncrementPurchase" />
          <Field label="Increment: Rate" field="affinityIncrementRate" />
        </View>
        <View style={styles.row2}>
          <Field label="Decay Factor" field="decayFactor" step="0.001" />
          <Field label="Exploration %" field="explorationPercentage" />
        </View>
        <View style={styles.row2}>
          <Field label="Category Diversity Limit" field="categoryDiversityLimit" step="1" />
          <Field label="Top N" field="topN" step="1" />
        </View>

        <Pressable
          style={[styles.saveBtn, saveMut.isPending && styles.disabled]}
          onPress={handleSave}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Configuration</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.pageBg },
  content: { padding: 16, paddingBottom: 60 },
  section: { fontSize: 16, fontWeight: "800", color: ui.text, marginTop: 20, marginBottom: 10 },
  row2: { flexDirection: "row", gap: 10 },
  field: { flex: 1, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: ui.textMuted, marginBottom: 4 },
  input: { backgroundColor: ui.card, borderWidth: 1, borderColor: ui.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: ui.text },
  inputDisabled: { backgroundColor: "#f3f4f6", color: "#9ca3af" },
  hint: { fontSize: 13, color: ui.textMuted, marginBottom: 8, fontWeight: "600" },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: ui.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: ui.card },
  chipActive: { backgroundColor: brand.base, borderColor: brand.base },
  chipText: { fontSize: 13, color: "#334155", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  saveBtn: { backgroundColor: brand.base, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 24, ...shadows.soft },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
