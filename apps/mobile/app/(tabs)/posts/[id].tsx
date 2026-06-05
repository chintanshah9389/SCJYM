import React from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "@/lib/theme";

interface PostAd {
  id: string;
  title: string;
  subtitle?: string;
  content?: string;
  mediaUrl: string;
  mediaType: string;
  badge?: string;
  badgeColor?: string;
  linkType?: string;
  linkTarget?: string;
  ctaLabel?: string;
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: post, isLoading, error } = useQuery<PostAd>({
    queryKey: ["ad-post", id],
    queryFn: () => api.get(`/ads/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  function handleCta() {
    if (!post?.linkTarget) return;
    if (post.linkType === "WEB_URL") {
      Linking.openURL(post.linkTarget).catch(() => {});
      return;
    }
    if (post.linkType === "SCREEN_ROUTE") {
      router.push(post.linkTarget as any);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={brand.base} style={styles.loading} />
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Post not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          {post.mediaType === "IMAGE" ? (
            <Image source={{ uri: post.mediaUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.mediaFallback]}>
              <Text style={styles.mediaFallbackIcon}>▶</Text>
              <Text style={styles.mediaFallbackText}>Open media from the carousel CTA</Text>
            </View>
          )}

          <View style={styles.body}>
            {!!post.badge && (
              <View style={[styles.badge, { backgroundColor: post.badgeColor ?? brand.base }]}>
                <Text style={styles.badgeText}>{post.badge}</Text>
              </View>
            )}
            <Text style={styles.title}>{post.title}</Text>
            {!!post.subtitle && <Text style={styles.subtitle}>{post.subtitle}</Text>}
            <Text style={styles.contentText}>{post.content?.trim() || "No post content was added yet."}</Text>

            {post.linkTarget && post.linkType !== "POST_PAGE" && (
              <TouchableOpacity style={styles.ctaBtn} onPress={handleCta}>
                <Text style={styles.ctaBtnText}>{post.ctaLabel?.trim() || "Open link"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.pageBg },
  loading: { marginTop: 60 },
  content: { padding: 16, paddingBottom: 40 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: ui.text },
  backBtn: { backgroundColor: brand.base, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  backBtnText: { color: "#fff", fontWeight: "700" },
  backLink: { marginBottom: 14, alignSelf: "flex-start" },
  backLinkText: { color: brand.base, fontSize: 15, fontWeight: "700" },
  card: {
    backgroundColor: ui.card,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  heroImage: { width: "100%", height: 240, backgroundColor: "#e2e8f0" },
  mediaFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#1e3a8a" },
  mediaFallbackIcon: { fontSize: 38, color: "#fff" },
  mediaFallbackText: { marginTop: 8, color: "rgba(255,255,255,0.85)", fontSize: 13 },
  body: { padding: 18 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: ui.text },
  subtitle: { marginTop: 8, fontSize: 15, lineHeight: 22, color: ui.textMuted },
  contentText: { marginTop: 16, fontSize: 15, lineHeight: 24, color: ui.text },
  ctaBtn: {
    marginTop: 20,
    alignSelf: "flex-start",
    backgroundColor: brand.base,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  ctaBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});