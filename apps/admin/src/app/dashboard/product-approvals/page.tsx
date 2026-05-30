"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { createApiClient } from "@/lib/api";

export default function ProductApprovalsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = createApiClient((session as any)?.accessToken);

  const { data, isLoading } = useQuery({
    queryKey: ["products-pending"],
    queryFn: () =>
      api.get("/products?status=SUBMITTED&limit=50").then((r) => r.data.data?.items ?? []),
    enabled: !!session,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/products/${id}/approval`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products-pending"] }),
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Product Approvals</h1>
      {(!data || data.length === 0) ? (
        <p className="text-gray-500">No products pending approval.</p>
      ) : (
        <div className="space-y-4">
          {data.map((product: any) => (
            <div key={product.id} className="bg-white rounded-xl shadow p-6 flex items-start justify-between">
              <div className="flex-1 pr-6">
                <p className="font-semibold text-gray-900">{product.title}</p>
                <p className="text-sm text-gray-500 mt-1">{product.description?.slice(0, 120)}…</p>
                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                  <span>Category: {product.category}</span>
                  <span>Price: ₹{product.price}</span>
                  <span>Stock: {product.inventory}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => actionMutation.mutate({ id: product.id, status: "APPROVED" })}
                  className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => actionMutation.mutate({ id: product.id, status: "REJECTED" })}
                  className="bg-red-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-600"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
