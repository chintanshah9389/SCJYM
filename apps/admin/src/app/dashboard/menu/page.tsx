"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { createApiClient } from "@/lib/api";

const MENU_TYPES = ["SCREEN_ROUTE", "WEB_URL", "YOUTUBE_URL", "LIVE_URL", "CATEGORY"];
const ROLES = ["MEMBER", "ADMIN", "SUPER_ADMIN"];

const DEFAULT_FORM = { label: "", icon: "", order: 0, enabled: true, rolesVisible: ["MEMBER", "ADMIN", "SUPER_ADMIN"], type: "SCREEN_ROUTE", target: "" };

export default function MenuPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = createApiClient((session as any)?.accessToken);

  const [form, setForm] = useState<any>(DEFAULT_FORM);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["menu-admin"],
    queryFn: () => api.get("/admin/menu").then((r) => r.data.data ?? []),
    enabled: !!session,
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editId ? api.put(`/admin/menu/${editId}`, data) : api.post("/admin/menu", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu-admin"] }); setEditId(null); setForm(DEFAULT_FORM); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/menu/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-admin"] }),
  });

  function startEdit(item: any) {
    setEditId(item.id);
    setForm({ label: item.label, icon: item.icon ?? "", order: item.order, enabled: item.enabled, rolesVisible: item.rolesVisible, type: item.type, target: item.target });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Menu Manager</h1>
      <div className="grid grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-lg mb-4">{editId ? "Edit Item" : "New Item"}</h2>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Label" value={form.label} onChange={(e) => setForm((f: any) => ({ ...f, label: e.target.value }))} required />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Icon (optional)" value={form.icon} onChange={(e) => setForm((f: any) => ({ ...f, icon: e.target.value }))} />
            <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="Order" value={form.order} onChange={(e) => setForm((f: any) => ({ ...f, order: +e.target.value }))} />
            <select className="w-full border rounded px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm((f: any) => ({ ...f, type: e.target.value }))}>
              {MENU_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Target (route / URL)" value={form.target} onChange={(e) => setForm((f: any) => ({ ...f, target: e.target.value }))} required />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f: any) => ({ ...f, enabled: e.target.checked }))} />
              Enabled
            </label>
            <button type="submit" className="bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
              {editId ? "Update" : "Add Item"}
            </button>
            {editId && <button type="button" className="ml-2 text-gray-500 text-sm" onClick={() => { setEditId(null); setForm(DEFAULT_FORM); }}>Cancel</button>}
          </form>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-lg mb-4">Menu Items</h2>
          {isLoading ? <p>Loading…</p> : (
            <div className="space-y-3">
              {(items ?? []).map((item: any) => (
                <div key={item.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.type} → {item.target}</p>
                    <span className={`text-xs font-medium ${item.enabled ? "text-green-600" : "text-gray-400"}`}>{item.enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(item)} className="text-blue-600 text-xs font-medium">Edit</button>
                    <button onClick={() => deleteMutation.mutate(item.id)} className="text-red-500 text-xs font-medium">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
