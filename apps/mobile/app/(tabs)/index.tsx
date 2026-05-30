import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import AdCarousel from "../../components/AdCarousel";
import NotifCarousel from "../../components/NotifCarousel";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: bestSellers } = useQuery({
    queryKey: ["best-sellers"],
    queryFn: () =>
      api.get("/products/best-sellers?window=weekly&region=GLOBAL").then(
        (r) => r.data.data?.items ?? []
      ),
  });

  const { data: personalizedData } = useQuery({
    queryKey: ["best-sellers-personalized"],
    queryFn: () =>
      api.get("/products/best-sellers/personalized?limit=10").then(
        (r) => r.data.data
      ),
    enabled: !!user,
  });

  const personalized: any[] = personalizedData?.items ?? [];
  const isPersonalized: boolean = personalizedData?.personalized ?? false;

  const { data: menuItems } = useQuery({
    queryKey: ["menu"],
    queryFn: () => api.get("/menu").then((r) => r.data.data ?? []),
  });

  function ProductCard({ item, rank }: { item: any; rank?: number }) {
    const p = item.product ?? item;
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() =>
          router.push({ pathname: "/(tabs)/product/[id]" as any, params: { id: p.id } })
        }
      >
        {rank !== undefined && (
          <Text style={styles.rank}>#{rank}</Text>
        )}
        {item.isExploration && (
          <View style={styles.exploreBadge}>
            <Text style={styles.exploreBadgeText}>Discover</Text>
          </View>
        )}
        <Text style={styles.productTitle} numberOfLines={2}>{p.title}</Text>
        <Text style={styles.productPrice}>₹{p.price}</Text>
        <Text style={styles.productRating}>
          ★ {p.avgRating?.toFixed(1) ?? "—"} ({p.ratingCount ?? 0})
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Ad Carousel ────────────────────────────────────── */}
      <AdCarousel />

      {/* ── Notification mini-carousel ────────────────────── */}
      <NotifCarousel />

      {/* Dynamic menu chips */}
      {menuItems && menuItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {menuItems.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuChip}
                onPress={() => {
                  if (item.type === "SCREEN_ROUTE") router.push(item.target as any);
                  else if (item.type === "YOUTUBE_URL" || item.type === "LIVE_URL")
                    router.push({ pathname: "/video", params: { url: item.target } });
                }}
              >
                <Text style={styles.menuChipText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Personalized section */}
      {isPersonalized && personalized.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Recommended for You</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {personalized.map((item: any, idx: number) => (
              <View key={item.product?.id ?? idx} style={styles.hCard}>
                <ProductCard item={item} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Global best sellers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔥 Best Sellers</Text>
        {bestSellers?.map((item: any) => (
          <ProductCard key={item.product?.id} item={item} rank={item.rank} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { paddingTop: 16, paddingHorizontal: 0, paddingBottom: 32 },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12, color: "#111827" },
  menuChip: {
    backgroundColor: "#1a56db",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  menuChipText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  hCard: { width: 180, marginRight: 12 },
  rank: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "700",
    marginBottom: 4,
  },
  exploreBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  exploreBadgeText: { fontSize: 10, color: "#92400e", fontWeight: "600" },
  productTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 },
  productPrice: { fontSize: 14, color: "#1a56db", fontWeight: "600" },
  productRating: { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
