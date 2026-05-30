"use client";
/**
 * Admin: Products list — view all products regardless of status,
 * with inline approve/reject and lock/unlock actions.
 */
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createApiClient } from "@/lib/api";

type Product = {
  _id: string;
  title: string;
  status: string;
  category: string;
  price: number;
  avgRating: number;
  ratingCount: number;
  bestSellerScore: number;
  locked: boolean;
  submittedBy?: string;
  approvedBy?: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  LOCKED: "bg-purple-100 text-purple-700",
};

export default function AdminProductsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const api = createApiClient((session as any)?.accessToken as string);
  const limit = 20;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", page, search, statusFilter],
    queryFn: () => api.get(`/products?${params}`).then((r) => r.data.data),
    enabled: !!session,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.patch(`/products/${id}/approval`, { status, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const lockMut = useMutation({
    mutationFn: ({ id, lock }: { id: string; lock: boolean }) =>
      api.patch(`/products/${id}/lock`, { lock }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const products: Product[] = data?.items ?? [];
  const total: number = data?.total ?? 0;
  const totalPages: number = data?.totalPages ?? 1;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "LOCKED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Category", "Price", "Status", "Rating", "Score", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wide text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No products found.
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{p.title}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category}</td>
                  <td className="px-4 py-3 text-gray-700 font-semibold">₹{p.price.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.status}
                      {p.locked && " 🔒"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.avgRating?.toFixed(1) ?? "—"} ({p.ratingCount ?? 0})
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {p.bestSellerScore?.toFixed(4) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.status === "SUBMITTED" && (
                        <>
                          <button
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                            onClick={() => approveMut.mutate({ id: p._id, status: "APPROVED" })}
                          >
                            Approve
                          </button>
                          <button
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                            onClick={() => { setRejectModal({ id: p._id }); setRejectReason(""); }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {p.status === "APPROVED" && (
                        <button
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
                          onClick={() => lockMut.mutate({ id: p._id, lock: !p.locked })}
                        >
                          {p.locked ? "Unlock" : "Lock"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reject Product</h2>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Reason for rejection (shown to submitter)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  approveMut.mutate({ id: rejectModal.id, status: "REJECTED", reason: rejectReason });
                  setRejectModal(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
