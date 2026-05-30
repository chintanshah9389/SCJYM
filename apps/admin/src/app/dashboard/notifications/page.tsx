"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { createApiClient } from "@/lib/api";

export default function NotificationsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = createApiClient((session as any)?.accessToken);

  const [form, setForm] = useState({
    title: "",
    body: "",
    imageUrl: "",
    youtubeUrl: "",
    deepLink: "",
  });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  const { data: history } = useQuery({
    queryKey: ["notifications-history"],
    queryFn: () => api.get("/admin/notifications?limit=20").then((r) => r.data.data?.items ?? []),
    enabled: !!session,
  });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg("");
    try {
      await api.post("/admin/notifications/push", form);
      setMsg("Notification sent successfully!");
      setForm({ title: "", body: "", imageUrl: "", youtubeUrl: "", deepLink: "" });
      qc.invalidateQueries({ queryKey: ["notifications-history"] });
    } catch (err: any) {
      setMsg(err?.response?.data?.error?.message ?? "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Push Notifications</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Compose</h2>
        <form onSubmit={handleSend} className="space-y-4">
          {[
            ["title", "Title *", "text"],
            ["body", "Message *", "text"],
            ["imageUrl", "Image URL (optional)", "url"],
            ["youtubeUrl", "YouTube URL (optional)", "url"],
            ["deepLink", "Deep Link (optional, e.g. scjygm://product/123)", "text"],
          ].map(([k, label, type]) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={(form as any)[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            </div>
          ))}
          {msg && <p className={`text-sm ${msg.includes("success") ? "text-green-600" : "text-red-500"}`}>{msg}</p>}
          <button type="submit" disabled={sending} className="bg-blue-700 text-white rounded-lg px-6 py-2 font-medium disabled:opacity-50">
            {sending ? "Sending…" : "Send to All Users"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Notifications</h2>
        {!history?.length ? (
          <p className="text-gray-500 text-sm">No notifications sent yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((n: any) => (
              <div key={n.id} className="border-b pb-3">
                <p className="font-medium text-gray-800 text-sm">{n.title}</p>
                <p className="text-gray-500 text-sm">{n.body}</p>
                <p className="text-gray-400 text-xs mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
