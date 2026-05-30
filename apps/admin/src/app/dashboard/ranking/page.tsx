"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { createApiClient } from "@/lib/api";

export default function RankingConfigPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = createApiClient((session as any)?.accessToken);

  const { data: config, isLoading } = useQuery({
    queryKey: ["ranking-config"],
    queryFn: () => api.get("/admin/ranking-config").then((r) => r.data.data),
    enabled: !!session,
  });

  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState("");

  if (config && !form) setForm(config);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put("/admin/ranking-config", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ranking-config"] }); setMsg("Saved successfully!"); },
    onError: (err: any) => setMsg(err?.response?.data?.error?.message ?? "Save failed"),
  });

  if (isLoading || !form) return <p>Loading…</p>;

  function field(key: string, label: string, type = "number", step?: string) {
    return (
      <div key={key}>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <input
          type={type}
          step={step}
          className="w-full border rounded px-3 py-2 text-sm"
          value={form[key] ?? ""}
          onChange={(e) => setForm((f: any) => ({ ...f, [key]: type === "number" ? +e.target.value : e.target.value }))}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Best Sellers & Ranking Config</h1>
      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); setMsg(""); }} className="bg-white rounded-xl shadow p-6 space-y-6">

        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Bayesian Rating</h2>
          <div className="grid grid-cols-2 gap-4">
            {field("priorStrength", "Prior Strength (m)", "number")}
            {field("minRatingCountForEligibility", "Min Rating Count", "number")}
            {field("minAvgRatingForEligibility", "Min Avg Rating", "number", "0.1")}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Global Mean Rating (C — read-only)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm bg-gray-50" value={form.globalMeanRating?.toFixed(3) ?? ""} readOnly />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Best Seller Weights (must sum to 1.0)</h2>
          <div className="grid grid-cols-2 gap-4">
            {field("weightSales", "Sales Weight", "number", "0.01")}
            {field("weightRating", "Rating Weight", "number", "0.01")}
            {field("weightRatingVolume", "Rating Volume Weight", "number", "0.01")}
            {field("weightRecency", "Recency Weight", "number", "0.01")}
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Region</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Region Level</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.regionLevel} onChange={(e) => setForm((f: any) => ({ ...f, regionLevel: e.target.value }))}>
                {["CITY", "STATE", "PINCODE"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            {field("minRegionProductCount", "Min Region Products", "number")}
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Personalization</h2>
          <div className="grid grid-cols-2 gap-4">
            {field("affinityWeightBase", "Affinity Base (0.70)", "number", "0.01")}
            {field("affinityWeightPersonal", "Affinity Personal (0.30)", "number", "0.01")}
            {field("affinityIncrementView", "Increment: View", "number", "0.1")}
            {field("affinityIncrementAddToCart", "Increment: Add to Cart", "number", "0.1")}
            {field("affinityIncrementPurchase", "Increment: Purchase", "number", "0.1")}
            {field("affinityIncrementRate", "Increment: Rate", "number", "0.1")}
            {field("decayFactor", "Decay Factor (daily)", "number", "0.001")}
            {field("explorationPercentage", "Exploration %", "number", "0.01")}
            {field("categoryDiversityLimit", "Category Diversity Limit", "number")}
            {field("topN", "Top N", "number")}
          </div>
          <label className="flex items-center gap-2 text-sm mt-3">
            <input type="checkbox" checked={form.personalizationEnabled ?? true} onChange={(e) => setForm((f: any) => ({ ...f, personalizationEnabled: e.target.checked }))} />
            Personalization Enabled
          </label>
        </section>

        {msg && <p className={`text-sm ${msg.includes("success") ? "text-green-600" : "text-red-500"}`}>{msg}</p>}
        <button type="submit" className="bg-blue-700 text-white rounded-lg px-6 py-2 font-medium">Save Configuration</button>
      </form>
    </div>
  );
}
