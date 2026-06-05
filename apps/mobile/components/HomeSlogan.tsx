import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { brand, shadows } from "@/lib/theme";
import BrandMark from "@/components/BrandMark";

const FALLBACK_CONTENT = {
  sloganTitle: "Built around your training journey",
  sloganSubtitle: "Discover trending gear, member picks, and personalized recommendations.",
};

interface HomeContent {
  sloganTitle: string;
  sloganSubtitle: string;
}

export default function HomeSlogan() {
  const { data, isLoading } = useQuery<HomeContent>({
    queryKey: ["home-content"],
    queryFn: () => api.get("/ads/home-content").then((r) => r.data.data ?? FALLBACK_CONTENT),
    staleTime: 60_000,
  });

  const content = data ?? FALLBACK_CONTENT;

  return (
    <LinearGradient
      colors={brand.gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroWrap}
    >
      <View style={styles.heroFoldA} />
      <View style={styles.heroFoldB} />
      <View style={styles.heroFoldAccent} />
      <BrandMark size={54} light style={styles.heroMark} />
      <Text style={styles.heroEyebrow}>SCJYGM</Text>
      <Text style={styles.heroTitle}>{content.sloganTitle}</Text>
      <Text style={styles.heroSub}>{content.sloganSubtitle}</Text>
      {isLoading && <ActivityIndicator color="rgba(255,255,255,0.92)" style={styles.loader} />}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    paddingVertical: 18,
    paddingHorizontal: 16,
    overflow: "hidden",
    position: "relative",
    ...shadows.card,
  },
  heroFoldA: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    right: 28,
    top: -22,
    transform: [{ rotate: "30deg" }],
  },
  heroFoldB: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    right: 70,
    top: 20,
    transform: [{ rotate: "-22deg" }],
  },
  heroFoldAccent: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(227,27,63,0.9)",
    right: 38,
    top: 24,
    transform: [{ rotate: "45deg" }],
  },
  heroMark: {
    position: "absolute",
    right: 14,
    bottom: 12,
    opacity: 0.9,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 21,
    lineHeight: 26,
    color: "#fff",
    fontWeight: "800",
    paddingRight: 64,
  },
  heroSub: {
    marginTop: 7,
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 18,
    paddingRight: 52,
  },
  loader: {
    position: "absolute",
    top: 16,
    right: 16,
  },
});