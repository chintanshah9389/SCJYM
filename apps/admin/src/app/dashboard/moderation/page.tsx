"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { createApiClient } from "@/lib/api";

export default function ModerationPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = createApiClient((session as any)?.accessToken);

  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["comments-admin", page],
    queryFn: () => api.get(`/admin/comments?page=${page}&limit=20`).then((r) => r.data.data),
    enabled: !!session,
  });

  const hideMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/comments/${id}/hide`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments-admin"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/comments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments-admin"] }),
  });

  const comments = data?.items ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Comments Moderation</h1>
      {isLoading ? <p>Loading…</p> : comments.length === 0 ? <p className="text-gray-500">No comments.</p> : (
        <div className="space-y-4">
          {comments.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl shadow p-5 flex items-start justify-between">
              <div className="flex-1 pr-4">
                <p className="text-sm font-semibold text-gray-800">{c.userFullName}</p>
                <p className="text-sm text-gray-600 mt-1">{c.body}</p>
                <p className="text-xs text-gray-400 mt-1">Product: {c.productId} · {new Date(c.createdAt).toLocaleString()}</p>
                <span className={`text-xs font-medium mt-1 inline-block ${c.status === "VISIBLE" ? "text-green-600" : c.status === "HIDDEN" ? "text-yellow-600" : "text-red-500"}`}>{c.status}</span>
              </div>
              <div className="flex gap-2">
                {c.status === "VISIBLE" && (
                  <button onClick={() => hideMutation.mutate(c.id)} className="bg-yellow-500 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-yellow-600">Hide</button>
                )}
                <button onClick={() => deleteMutation.mutate(c.id)} className="bg-red-500 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border rounded disabled:opacity-40 text-sm">Prev</button>
        <span className="text-sm text-gray-500 self-center">Page {page} of {data?.totalPages ?? 1}</span>
        <button onClick={() => setPage((p) => p + 1)} disabled={page >= (data?.totalPages ?? 1)} className="px-4 py-2 border rounded disabled:opacity-40 text-sm">Next</button>
      </div>
    </div>
  );
}
