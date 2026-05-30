"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { createApiClient } from "@/lib/api";

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = createApiClient((session as any)?.accessToken);

  const { data, isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: () =>
      api.get("/users?status=PENDING_APPROVAL&limit=50").then((r) => r.data.data?.items ?? []),
    enabled: !!session,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/users/${id}/approval`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-users"] }),
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Approvals</h1>
      {(!data || data.length === 0) ? (
        <p className="text-gray-500">No pending approvals.</p>
      ) : (
        <div className="space-y-4">
          {data.map((user: any) => (
            <div key={user.id} className="bg-white rounded-xl shadow p-6 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{user.fullName}</p>
                <p className="text-sm text-gray-500">{user.email} · {user.mobile}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {user.address?.city}, {user.address?.state} — {user.address?.pincode}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Registered: {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => approveMutation.mutate({ id: user.id, status: "APPROVED" })}
                  className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => approveMutation.mutate({ id: user.id, status: "REJECTED" })}
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
