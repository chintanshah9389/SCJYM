import React from "react";
import { View, StyleSheet, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";
import { brand } from "../../lib/theme";

export default function VideoScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();

  function getEmbedUrl(rawUrl: string): string {
    // Convert YouTube watch URL to embed URL
    const ytMatch = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    }
    return rawUrl;
  }

  if (!url) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No video URL provided.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: getEmbedUrl(url ?? "") }}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.base },
  webview: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: brand.base,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: brand.base,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
