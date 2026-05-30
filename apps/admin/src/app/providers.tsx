"use client";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
          },
          mutations: {
            onError: (err: any) => {
              const msg =
                err?.response?.data?.error?.message ??
                err?.response?.data?.detail ??
                err?.message ??
                "Action failed";
              toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
            },
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "8px",
              fontSize: "14px",
              maxWidth: "420px",
            },
            error: {
              style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
              iconTheme: { primary: "#dc2626", secondary: "#fef2f2" },
            },
            success: {
              style: { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
              iconTheme: { primary: "#16a34a", secondary: "#f0fdf4" },
            },
          }}
        />
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
