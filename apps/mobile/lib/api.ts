import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { toastEmitter } from "./toastEmitter";

const PROD_API_BASE = "https://scjym-api.onrender.com/api/v1";

function getApiBase(): string {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const useProd = process.env.EXPO_PUBLIC_USE_PROD === "true";
  if (configuredBaseUrl) return configuredBaseUrl;
  if (useProd) return PROD_API_BASE;
  // In a native dev build (Expo Go / dev client), derive host from the Metro bundler address
  // so it works on physical devices and emulators without hardcoding an IP.
  if (__DEV__ && Platform.OS !== "web") {
    const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(":")[0];
      return `http://${host}:8000/api/v1`;
    }
  }
  return PROD_API_BASE;
}

const API_BASE = getApiBase();
let hasReportedApiBase = false;

function reportResolvedApiBase() {
  if (hasReportedApiBase) return;
  hasReportedApiBase = true;

  console.info(`[api] Using backend: ${API_BASE}`);

  if (__DEV__) {
    toastEmitter.emit(`API: ${API_BASE}`, "success");
  }
}

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

function getApiMessage(payload: any): string | null {
  const msg =
    payload?.data?.message ??
    payload?.message ??
    payload?.error?.message ??
    payload?.detail?.message ??
    payload?.detail;
  return typeof msg === "string" && msg.trim().length > 0 ? msg : null;
}

// ── Request interceptor: attach access token ──────────────────────────────
api.interceptors.request.use(async (config) => {
  reportResolvedApiBase();
  const token = await getToken("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: transparent token refresh ───────────────────────
api.interceptors.response.use(
  (res) => {
    const method = (res.config?.method ?? "get").toLowerCase();
    const shouldToast = ["post", "put", "patch", "delete"].includes(method);
    const suppressToast = res.config?.headers?.["x-no-toast"] === "1";

    if (shouldToast && !suppressToast) {
      const msg = getApiMessage(res.data) ?? "Request completed successfully";
      toastEmitter.emit(msg, "success");
    }

    return res;
  },
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
      const msg = getApiMessage(error.response?.data) ?? error.message ?? "Request failed";
      toastEmitter.emit(typeof msg === "string" ? msg : JSON.stringify(msg), "error");
    }

    return Promise.reject(error);
  }
);
