/**
 * Push notification registration hook.
 * Call once at app startup (inside AuthProvider or HomeScreen mount).
 * Saves Expo push token to backend via PATCH /api/v1/users/me/fcm-token.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import { api } from "@/lib/api";

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
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        api.patch("/users/me/fcm-token", { fcmToken: token }).catch(() => {});
      }
    });
  }, [userId]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const Device = require("expo-device");
  const Notifications = require("expo-notifications");

  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

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
