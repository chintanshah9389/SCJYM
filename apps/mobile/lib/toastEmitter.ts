/**
 * Singleton bridge so code outside React (axios interceptors, etc.)
 * can trigger toasts rendered inside the ToastProvider.
 *
 * Usage (from React):
 *   toastEmitter.setListener(showToast);
 *
 * Usage (from anywhere else):
 *   toastEmitter.emit("Request failed", "error");
 */

export type ToastType = "success" | "error" | "warning" | "info";

type Listener = (message: string, type: ToastType) => void;

let _listener: Listener | null = null;

export const toastEmitter = {
  setListener(fn: Listener) {
    _listener = fn;
  },
  clearListener() {
    _listener = null;
  },
  emit(message: string, type: ToastType = "error") {
    _listener?.(message, type);
  },
};
