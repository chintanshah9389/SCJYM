/**
 * Admin Hub — landing page for the admin section.
 * Shows live stat cards and quick-nav to each admin screen.
 * File: apps/mobile/app/admin/index.tsx
 */
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { brand, ui, shadows } from "@/lib/theme";

const ADMIN_LINKS = [
  { label: "👤 User Approvals", href: "/admin/user-approvals", color: "#1a56db" },
  { label: "📦 Product Approvals", href: "/admin/product-approvals", color: "#059669" },
  { label: "📝 Posts", href: "/admin/posts", color: "#be123c" },
  { label: "📣 Advertisements", href: "/admin/advertisements", color: "#f59e0b" },
  { label: "💬 Moderation", href: "/admin/moderation", color: "#7c3aed" },
  { label: "🔔 Push Notifications", href: "/admin/push-notifications", color: "#d97706" },
  { label: "📋 Menu Manager", href: "/admin/menu-manager", color: "#0891b2" },
  { label: "⭐ Ranking Config", href: "/admin/ranking-config", color: "#dc2626" },
  { label: "👥 All Members", href: "/(tabs)/members", color: "#374151" },
];

export default function AdminHubScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [u, p, pu, pp] = await Promise.all([
        api.get("/users?limit=1").catch(() => null),
        api.get("/products?limit=1").catch(() => null),
        api.get("/users?status=PENDING&limit=1").catch(() => null),
        api.get("/products?status=SUBMITTED&limit=1").catch(() => null),
      ]);
      return {
        totalUsers: u?.data?.data?.total ?? "—",
        totalProducts: p?.data?.data?.total ?? "—",
        pendingUsers: pu?.data?.data?.total ?? "—",
        pendingProducts: pp?.data?.data?.total ?? "—",
      };
    },
  });

  const stats = statsData ?? { totalUsers: "—", totalProducts: "—", pendingUsers: "—", pendingProducts: "—" };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin Panel</Text>
      <Text style={styles.subtitle}>Logged in as {user?.fullName} ({user?.role})</Text>

      {isLoading ? (
        <ActivityIndicator color={brand.base} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard label="Members" value={stats.totalUsers} color="#1a56db" />
          <StatCard label="Products" value={stats.totalProducts} color="#059669" />
          <StatCard label="Pending Users" value={stats.pendingUsers} color="#d97706" onPress={() => router.push("/admin/user-approvals" as any)} />
          <StatCard label="Pending Products" value={stats.pendingProducts} color="#dc2626" onPress={() => router.push("/admin/product-approvals" as any)} />
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      {ADMIN_LINKS.map((link) => (
        <TouchableOpacity
          key={link.href}
          style={[styles.link, { borderLeftColor: link.color }]}
          onPress={() => router.push(link.href as any)}
        >
          <Text style={styles.linkText}>{link.label}</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function StatCard({ label, value, color, onPress }: { label: string; value: any; color: string; onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.pageBg },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: ui.text, marginBottom: 2 },
  subtitle: { fontSize: 13, color: ui.textMuted, marginBottom: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: ui.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  statValue: { fontSize: 32, fontWeight: "800", marginBottom: 4 },
  statLabel: { fontSize: 13, color: ui.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#334155", marginBottom: 10 },
  link: {
    backgroundColor: ui.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.soft,
  },
  linkText: { fontSize: 15, fontWeight: "700", color: ui.text },
  arrow: { fontSize: 20, color: "#9ca3af" },
});
