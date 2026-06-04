/**
 * Push notification registration hook.
 * Call once at app startup (inside AuthProvider or HomeScreen mount).
 * Saves Expo push token to backend via PATCH /api/v1/users/me/fcm-token.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "@/lib/api";

function getExpoProjectId(): string | null {
  const envProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (envProjectId && envProjectId !== "your-eas-project-id") {
    return envProjectId;
  }

  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  return typeof easProjectId === "string" && easProjectId.trim().length > 0
    ? easProjectId
    : null;
}

function isExpoGo(): boolean {
  return (
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === "storeClient"
  );
}

// Only register notification handler on native platforms
if (Platform.OS !== "web") {
  const Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export function usePushNotifications(userId?: string) {
  useEffect(() => {
    if (!userId || Platform.OS === "web") return;

    if (isExpoGo()) {
      console.warn("Push registration skipped in Expo Go. Use a development build for remote push notifications.");
      return;
    }

    (async () => {
      try {
        console.log("🔔 Registering for push notifications...");
        const token = await registerForPushNotificationsAsync();
        console.log("🔔 Got token:", token ? `${token.slice(0, 20)}...` : "null");
        if (token) {
          // Retry up to 3 times — Render free tier cold starts can take 30-50s,
          // exceeding the default axios timeout on the first attempt.
          let saved = false;
          for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
            try {
              await api.patch("/users/me/fcm-token", { fcmToken: token }, { timeout: 60_000 });
              console.log("✅ FCM token saved to backend");
              saved = true;
            } catch (e: any) {
              console.warn(`⚠️ FCM token save attempt ${attempt}/3 failed:`, e?.response?.data || e?.message);
              if (attempt < 3) await new Promise((r) => setTimeout(r, 5000));
            }
          }
          if (!saved) {
            console.error("❌ Failed to save FCM token after 3 attempts");
          }
        } else {
          console.warn("⚠️ No push token obtained (permissions denied?)");
        }
      } catch (e) {
        console.error("❌ Push registration error:", e);
      }
    })();

    // Set up listeners for incoming notifications
    setupNotificationListeners();
  }, [userId]);
}

function setupNotificationListeners() {
  if (Platform.OS === "web") return;

  const Notifications = require("expo-notifications");

  // Listen for notifications received while app is foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener((notification:any) => {
    console.log("📬 Notification received (foreground):", notification.request.content.title);
  });

  // Listen for notifications tapped while app is closed or backgrounded
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response:any) => {
    const { title, body } = response.notification.request.content;
    const deepLink = response.notification.request.content.data?.deepLink;
    console.log("👆 Notification tapped:", title);
    
    // Handle deep linking if provided
    if (deepLink) {
      console.log("🔗 Navigating to:", deepLink);
      // Deep linking would be handled by expo-linking setup
    }
  });

  // Cleanup on unmount
  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const Device = require("expo-device");
  const Notifications = require("expo-notifications");

  if (!Device.isDevice) {
    console.warn("⚠️ Not a physical device. Remote push needs a physical device.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("⚠️ Push notification permissions not granted");
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn("⚠️ Missing Expo projectId. Push token registration skipped.");
    return null;
  }

  // Android requires the notification channel to exist before fetching the token
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  return tokenData.data;
}
