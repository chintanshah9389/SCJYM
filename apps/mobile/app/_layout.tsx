import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View, Text, Image, StyleSheet, Animated, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { ThemeProvider, useAppTheme } from "../context/ThemeContext";
import { useRouter, useSegments } from "expo-router";
import { toastEmitter } from "../lib/toastEmitter";
import BrandMark from "../components/BrandMark";

const queryClient = new QueryClient();

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { theme } = useAppTheme();
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [showStinger, setShowStinger] = useState(true);
  const [stingerExiting, setStingerExiting] = useState(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (isLoading) {
      setShowStinger(true);
      setStingerExiting(false);
      return;
    }

    const startExit = setTimeout(() => setStingerExiting(true), 120);
    const hideSplash = setTimeout(() => setShowStinger(false), 720);

    return () => {
      clearTimeout(startExit);
      clearTimeout(hideSplash);
    };
  }, [isLoading]);

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
        } else if (data?.deepLink) {
          router.push(data.deepLink as any);
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

  if (isLoading || showStinger) {
    return <SplashScreen exiting={stingerExiting && !isLoading} splashColors={theme.brand.gradients.splash} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.brand.base },
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

function SplashScreen({
  exiting = false,
  splashColors,
}: {
  exiting?: boolean;
  splashColors: readonly [string, string, string];
}) {
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0.84)).current;
  const ringOpacity = useRef(new Animated.Value(0.4)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(10)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const foldLeftX = useRef(new Animated.Value(-42)).current;
  const foldRightX = useRef(new Animated.Value(42)).current;
  const foldTopY = useRef(new Animated.Value(-36)).current;
  const foldOpacity = useRef(new Animated.Value(0)).current;
  const pulseAccent = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(foldOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.spring(textY, { toValue: 0, useNativeDriver: true, tension: 58, friction: 9 }),
        Animated.spring(foldLeftX, { toValue: -14, useNativeDriver: true, tension: 64, friction: 8 }),
        Animated.spring(foldRightX, { toValue: 14, useNativeDriver: true, tension: 64, friction: 8 }),
        Animated.spring(foldTopY, { toValue: -16, useNativeDriver: true, tension: 64, friction: 8 }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.2, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.1, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 0.84, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -7, duration: 1300, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 10000, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAccent, { toValue: 0.75, duration: 950, useNativeDriver: true }),
        Animated.timing(pulseAccent, { toValue: 0.35, duration: 950, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!exiting) return;
    Animated.parallel([
      Animated.timing(exitOpacity, { toValue: 0, duration: 360, useNativeDriver: true }),
      Animated.timing(exitScale, { toValue: 1.03, duration: 360, useNativeDriver: true }),
    ]).start();
  }, [exiting]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={[splash.root, { opacity: exitOpacity, transform: [{ scale: exitScale }] }]}>
      <LinearGradient
        colors={splashColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[splash.foldShapeLeft, { opacity: foldOpacity, transform: [{ translateX: foldLeftX }, { rotate: "-22deg" }] }]} />
      <Animated.View style={[splash.foldShapeRight, { opacity: foldOpacity, transform: [{ translateX: foldRightX }, { rotate: "22deg" }] }]} />
      <Animated.View style={[splash.foldShapeTop, { opacity: foldOpacity, transform: [{ translateY: foldTopY }, { rotate: "45deg" }] }]} />
      <Animated.View style={[splash.accentDot, { opacity: pulseAccent }]} />
      <Animated.View style={[splash.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }, { rotate: spin }] }]} />
      <Animated.View style={[splash.circle, { transform: [{ scale }, { translateY: floatY }], opacity }]}>
        <Image source={require("../assets/icon.png")} style={splash.logoImage} resizeMode="contain" />
        <BrandMark size={88} light />
      </Animated.View>
      <Animated.Text style={[splash.name, { opacity: textOpacity, transform: [{ translateY: textY }] }]}>SCJYGM</Animated.Text>
      <Animated.Text style={[splash.tagline, { opacity: textOpacity, transform: [{ translateY: textY }] }]}>Origami-fast finance with trusted flow</Animated.Text>
    </Animated.View>
  );
}

const splash = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  foldShapeLeft: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    left: "26%",
    top: "31%",
  },
  foldShapeRight: {
    position: "absolute",
    width: 124,
    height: 124,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    right: "26%",
    top: "32%",
  },
  foldShapeTop: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: "rgba(255,122,69,0.32)",
    top: "23%",
  },
  accentDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff7a45",
    top: "30.5%",
    right: "34%",
  },
  ring: {
    position: "absolute",
    width: 198,
    height: 198,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  circle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  logoImage: {
    width: 56,
    height: 56,
    marginBottom: 8,
  },
  name: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1.3,
  },
  tagline: {
    fontSize: 12,
    color: "rgba(255,255,255,0.82)",
    marginTop: 6,
    letterSpacing: 0.45,
  },
});
