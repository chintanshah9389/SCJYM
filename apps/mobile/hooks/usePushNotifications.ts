/**
 * Push notification registration hook.
 * Call once at app startup (inside AuthProvider or HomeScreen mount).
 * Saves Expo push token to backend via PATCH /api/v1/users/me/fcm-token.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "@/lib/api";

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
      shouldSetBadge: false,
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
          try {
            await api.patch("/users/me/fcm-token", { fcmToken: token });
            console.log("✅ FCM token saved to backend");
          } catch (e: any) {
            console.error("❌ Failed to save FCM token:", e?.response?.data || e?.message);
          }
        } else {
          console.warn("⚠️ No push token obtained (permissions denied?)");
        }
      } catch (e) {
        console.error("❌ Push registration error:", e);
      }
    })();
  }, [userId]);
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

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  return tokenData.data;
}
