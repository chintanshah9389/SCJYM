import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { toastEmitter } from "./toastEmitter";

function getApiBase(): string {
  const useProd = process.env.EXPO_PUBLIC_USE_PROD === "true";
  if (useProd) return "https://scjym-api.onrender.com/api/v1";
  // In a native dev build (Expo Go / dev client), derive host from the Metro bundler address
  // so it works on physical devices and emulators without hardcoding an IP.
  if (__DEV__ && Platform.OS !== "web") {
    const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(":")[0];
      return `http://${host}:8000/api/v1`;
    }
  }
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
}

const API_BASE = getApiBase();

// Web-safe token storage
async function getToken(key: string): Promise<string | null> {
  if (Platform.OS === "web") return (window as any).localStorage.getItem(key);
  const { getItemAsync } = await import("expo-secure-store");
  return getItemAsync(key);
}
async function setToken(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") { (window as any).localStorage.setItem(key, value); return; }
  const { setItemAsync } = await import("expo-secure-store");
  return setItemAsync(key, value);
}
async function deleteToken(key: string): Promise<void> {
  if (Platform.OS === "web") { (window as any).localStorage.removeItem(key); return; }
  const { deleteItemAsync } = await import("expo-secure-store");
  return deleteItemAsync(key);
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach access token ──────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await getToken("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: transparent token refresh ───────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await getToken("refreshToken");
        if (!refreshToken) throw new Error("no refresh token");
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
        await setToken("accessToken", data.data.accessToken);
        await setToken("refreshToken", data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        await deleteToken("accessToken");
        await deleteToken("refreshToken");
      }
    }

    // Show error toast for all non-401 errors (401 handled above via refresh)
    if (error.response?.status !== 401) {
      const msg: string =
        error.response?.data?.error?.message ??
        error.response?.data?.detail ??
        error.message ??
        "Request failed";
      toastEmitter.emit(typeof msg === "string" ? msg : JSON.stringify(msg), "error");
    }

    return Promise.reject(error);
  }
);
