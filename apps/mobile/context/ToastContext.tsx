/**
 * Global toast context for the mobile app.
 * Usage:
 *   const { showToast } = useToast();
 *   showToast("Saved!", "success");
 *   showToast("Something went wrong", "error");
 */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { toastEmitter } from "../lib/toastEmitter";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

let idCounter = 0;

const TYPE_STYLE: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: "#059669", icon: "✓" },
  error:   { bg: "#dc2626", icon: "✕" },
  warning: { bg: "#d97706", icon: "⚠" },
  info:    { bg: "#1a56db", icon: "ℹ" },
};

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
      ]).start(() => onDone(toast.id));
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const { bg, icon } = TYPE_STYLE[toast.type];

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}>
      <Text style={styles.toastIcon}>{icon}</Text>
      <Text style={styles.toastMsg} numberOfLines={3}>{toast.message}</Text>
      <TouchableOpacity onPress={() => onDone(toast.id)} style={styles.toastClose}>
        <Text style={styles.toastCloseText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: ToastType = "info") {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
  }

  // Register with the module-level emitter so axios interceptors can trigger toasts
  useEffect(() => {
    toastEmitter.setListener(showToast);
    return () => toastEmitter.clearListener();
  }, []);

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.container}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={removeToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 56,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
    pointerEvents: "box-none" as any,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  toastIcon: { color: "#fff", fontSize: 16, fontWeight: "700", width: 20, textAlign: "center" },
  toastMsg: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "500", lineHeight: 19 },
  toastClose: { padding: 4 },
  toastCloseText: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
});
