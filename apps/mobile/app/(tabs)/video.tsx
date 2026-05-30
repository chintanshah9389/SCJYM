import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";

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

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: getEmbedUrl(url ?? "") }}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  webview: { flex: 1 },
});
