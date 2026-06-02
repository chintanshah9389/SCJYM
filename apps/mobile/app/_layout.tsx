import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { useRouter, useSegments } from "expo-router";
import { toastEmitter } from "../lib/toastEmitter";

const queryClient = new QueryClient();

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/login");
      return;
    }

    if (user.status !== "APPROVED") {
      toastEmitter.emit("Approval is pending. Please wait for admin approval.", "warning");
      void logout();
      if (!inAuthGroup) router.replace("/(auth)/login");
      return;
    }

    if (inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoading, user, segments, logout, router]);

  // Deep-link from notification taps (native only)
  useEffect(() => {
    if (!user || Platform.OS === "web") return;

    const Notifications = require("expo-notifications");

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response.notification.request.content.data as Record<string, string>;
        if (data?.productId) {
          router.push({ pathname: "(tabs)/product/[id]" as any, params: { id: data.productId } });
        } else if (data?.screen) {
          router.push(data.screen as any);
        }
      }
    );

    return () => {
      if (notificationListener.current)
        Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current)
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [user]);

  if (isLoading) return <SplashScreen />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: "#1a56db" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        headerBackTitle: "",
      }}
    >
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

export default RootLayout;

function SplashScreen() {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(dotsOpacity, { toValue: 1, duration: 300, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={splash.root}>
      <Animated.View style={[splash.circle, { transform: [{ scale }], opacity }]}>
        <Text style={splash.emoji}>🏆</Text>
      </Animated.View>
      <Animated.Text style={[splash.name, { opacity }]}>SCJYGM</Animated.Text>
      <Animated.Text style={[splash.tagline, { opacity }]}>Discover · Rank · Connect</Animated.Text>
      <Animated.View style={[splash.dotsRow, { opacity: dotsOpacity }]}>
        {[0, 1, 2].map((i) => (
          <BounceDot key={i} delay={i * 150} />
        ))}
      </Animated.View>
    </View>
  );
}

function BounceDot({ delay }: { delay: number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: -8, duration: 300, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[splash.dot, { transform: [{ translateY: y }] }]} />
  );
}

const splash = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1a56db",
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emoji: { fontSize: 52 },
  name: {
    fontSize: 40,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 6,
    letterSpacing: 1,
    marginBottom: 40,
  },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
});
