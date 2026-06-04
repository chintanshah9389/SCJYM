import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { api } from "../lib/api";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useWebPushNotifications } from "../hooks/useWebPushNotifications";

// expo-secure-store doesn't work on web — fall back to localStorage
const store = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return (window as any).localStorage.getItem(key);
    const { getItemAsync } = await import("expo-secure-store");
    return getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") { (window as any).localStorage.setItem(key, value); return; }
    const { setItemAsync } = await import("expo-secure-store");
    return setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") { (window as any).localStorage.removeItem(key); return; }
    const { deleteItemAsync } = await import("expo-secure-store");
    return deleteItemAsync(key);
  },
};

interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Register for push notifications whenever a user is logged in
  // Native push notifications (Android/iOS via Expo)
  usePushNotifications(user?.id);
  // Web push notifications (Browser)
  useWebPushNotifications(user?.id);

  useEffect(() => {
    (async () => {
      try {
        const token = await store.getItem("accessToken");
        if (token) {
          const { data } = await api.get("/users/me");
          setUser(data.data);
        }
      } catch {
        // token expired / invalid – clear storage
        await store.deleteItem("accessToken");
        await store.deleteItem("refreshToken");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    await store.setItem("accessToken", data.data.accessToken);
    await store.setItem("refreshToken", data.data.refreshToken);
    setUser(data.data.user);
  }

  async function logout() {
    const refreshToken = await store.getItem("refreshToken");
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }).catch(() => {});
    }
    await store.deleteItem("accessToken");
    await store.deleteItem("refreshToken");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
