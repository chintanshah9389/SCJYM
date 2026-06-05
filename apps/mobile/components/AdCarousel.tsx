/**
 * AdCarousel — full-width advertisement carousel for the home screen.
 * Auto-scrolls every 4.5 seconds.  Supports IMAGE, VIDEO, YOUTUBE media types.
 * Tapping navigates to linkTarget when linkType is set.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_W - 32; // 16px padding each side
const CARD_HEIGHT = 180;
const AUTO_SCROLL_INTERVAL = 4500;

export default function AdCarousel() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: ads = [] } = useQuery({
    queryKey: ["ads-active"],
    queryFn: () => api.get("/ads/active?limit=10").then((r) => r.data.data ?? []),
    staleTime: 60_000,
  });

  const scroll = useCallback(
    (index: number) => {
      if (!scrollRef.current || ads.length === 0) return;
      const safeIndex = index % ads.length;
      scrollRef.current.scrollTo({ x: safeIndex * CARD_WIDTH, animated: true });
      setActiveIndex(safeIndex);
    },
    [ads.length]
  );

  // Auto-advance
  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % ads.length;
        scrollRef.current?.scrollTo({ x: next * CARD_WIDTH, animated: true });
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ads.length]);

  function handleTap(ad: any) {
    if (ad.linkType === "POST_PAGE") {
      router.push({ pathname: "/posts/[id]", params: { id: ad.id } });
      return;
    }
    if (!ad.linkTarget) return;
    if (ad.linkType === "SCREEN_ROUTE") {
      router.push(ad.linkTarget as any);
    } else if (ad.linkType === "WEB_URL") {
      Linking.openURL(ad.linkTarget).catch(() => {});
    } else if (ad.mediaType === "YOUTUBE" || ad.mediaType === "VIDEO") {
      router.push({ pathname: "/video", params: { url: ad.mediaUrl } });
    }
  }

  function onScrollEnd(e: any) {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / CARD_WIDTH);
    setActiveIndex(newIndex);
    // Reset auto-scroll timer on manual swipe
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % ads.length;
        scrollRef.current?.scrollTo({ x: next * CARD_WIDTH, animated: true });
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);
  }

  if (ads.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={{ width: CARD_WIDTH * ads.length }}
      >
        {ads.map((ad: any) => (
          <TouchableOpacity
            key={ad.id}
            activeOpacity={ad.linkTarget || ad.linkType === "POST_PAGE" ? 0.88 : 1}
            style={styles.slide}
            onPress={() => handleTap(ad)}
          >
            {/* Media */}
            {ad.mediaType === "IMAGE" ? (
              <Image
                source={{ uri: ad.mediaUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.image, styles.videoPlaceholder]}>
                <Text style={styles.playIcon}>▶</Text>
                <Text style={styles.videoHint}>Tap to play</Text>
              </View>
            )}

            {/* Gradient overlay */}
            <View style={styles.overlay} />

            {/* Badge */}
            {!!ad.badge && (
              <View style={[styles.badge, { backgroundColor: ad.badgeColor ?? "#ef4444" }]}>
                <Text style={styles.badgeText}>{ad.badge}</Text>
              </View>
            )}

            {/* Text */}
            <View style={styles.textWrap}>
              <Text style={styles.adTitle} numberOfLines={1}>{ad.title}</Text>
              {!!ad.subtitle && (
                <Text style={styles.adSubtitle} numberOfLines={1}>{ad.subtitle}</Text>
              )}
              {ad.linkType === "POST_PAGE" && (
                <Text style={styles.ctaText}>{ad.ctaLabel?.trim() || "Read more"}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      {ads.length > 1 && (
        <View style={styles.dots}>
          {ads.map((_: any, i: number) => (
            <TouchableOpacity key={i} onPress={() => scroll(i)}>
              <View style={[styles.dot, activeIndex === i && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 20 },
  scroll: { borderRadius: 16, overflow: "hidden" },
  slide: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a56db",
  },
  image: { width: "100%", height: "100%", position: "absolute" },
  videoPlaceholder: {
    backgroundColor: "#1e40af",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { fontSize: 40, color: "rgba(255,255,255,0.9)" },
  videoHint: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  textWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  adTitle: { color: "#fff", fontSize: 17, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  adSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 2, textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  ctaText: { color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 8, letterSpacing: 0.5, textTransform: "uppercase" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d1d5db",
  },
  dotActive: {
    width: 18,
    backgroundColor: "#1a56db",
  },
});
