"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { createApiClient } from "@/lib/api";
import toast from "react-hot-toast";

export default function MembersPage() {
  const { data: session } = useSession();
  const api = createApiClient((session as any)?.accessToken);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["members-admin", q, page],
    queryFn: () =>
      api.get("/users", { params: { q: q || undefined, page, limit: 20 } }).then((r) => r.data.data),
    enabled: !!session,
  });

  const members = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const queryClient = useQueryClient();

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberMode, setMemberMode] = useState<"create" | "edit">("create");
  const [memberForm, setMemberForm] = useState<any>({
    fullName: "",
    email: "",
    mobile: "",
    address: { line1: "", line2: "", city: "", state: "", pincode: "", country: "IN" },
    role: "MEMBER",
    status: "APPROVED",
    password: "",
  });
  const [memberLoading, setMemberLoading] = useState(false);

  async function handleExport(fmt: "csv" | "xlsx") {
    try {
      const token = (session as any)?.accessToken;
      const url = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"}/users/export?fmt=${fmt}${q ? `&q=${q}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `members.${fmt}`;
      a.click();
      toast.success(`Members exported as ${fmt.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to export members");
    }
  }

  function openCreateModal() {
    setMemberMode("create");
    setMemberForm({
      fullName: "",
      email: "",
      mobile: "",
      address: { line1: "", line2: "", city: "", state: "", pincode: "", country: "IN" },
      role: "MEMBER",
      status: "APPROVED",
      password: "",
    });
    setShowMemberModal(true);
  }

  function openEditModal(m: any) {
    setMemberMode("edit");
    setSelectedMember(m);
    setMemberForm({
      fullName: m.fullName || "",
      email: m.email || "",
      mobile: m.mobile || "",
      address: {
        line1: m.address?.line1 || "",
        line2: m.address?.line2 || "",
        city: m.address?.city || "",
        state: m.address?.state || "",
        pincode: m.address?.pincode || "",
        country: m.address?.country || "IN",
      },
      role: m.role || "MEMBER",
      status: m.status || "APPROVED",
      password: "",
    });
    setShowMemberModal(true);
  }

  function closeMemberModal() {
    setShowMemberModal(false);
    setSelectedMember(null);
  }

  async function submitMemberForm() {
    setMemberLoading(true);
    try {
      if (memberMode === "create") {
        const res = await api.post("/users", memberForm);
        const pw = res?.data?.data?.password;
        toast.success(`User created. Password: ${pw ?? "(not returned)"}`);
      } else if (memberMode === "edit" && selectedMember) {
        await api.patch(`/users/${selectedMember.id}`, memberForm);
        toast.success("User updated.");
      }
      closeMemberModal();
      queryClient.invalidateQueries({ queryKey: ["members-admin"] });
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message ?? err?.message ?? "Failed to save user";
      toast.error(msg);
    } finally {
      setMemberLoading(false);
    }
  }

  async function handleDelete(m: any) {
    if (!confirm(`Delete user ${m.fullName} (${m.email})? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${m.id}`);
      toast.success("User deleted.");
      queryClient.invalidateQueries({ queryKey: ["members-admin"] });
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message ?? err?.message ?? "Failed to delete user";
      toast.error(msg);
    }
  }

  function openPwdModal(m: any) {
    setSelectedMember(m);
    setNewPassword("");
    setShowPwdModal(true);
  }

  function closePwdModal() {
    setShowPwdModal(false);
    setSelectedMember(null);
    setNewPassword("");
  }

  async function submitPasswordUpdate() {
    if (!selectedMember) return;
    setPwdLoading(true);
    try {
      await api.patch(`/users/${selectedMember.id}/password`, { newPassword });
      toast.success("Password updated successfully.");
      closePwdModal();
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message ?? err?.message ?? "Failed to update password";
      toast.error(msg);
    } finally {
      setPwdLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        <div className="flex gap-2">
          <button onClick={openCreateModal} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">Add Member</button>
          <button onClick={() => handleExport("csv")} className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200">Export CSV</button>
          <button onClick={() => handleExport("xlsx")} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700">Export XLSX</button>
        </div>
      </div>

      <div className="mb-4">
        <input
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search name, email, mobile..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Name", "Email", "Mobile", "City", "Role", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3 text-gray-600">{m.mobile}</td>
                  <td className="px-4 py-3 text-gray-600">{m.address?.city}</td>
                  <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{m.role}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${m.status === "APPROVED" ? "bg-green-100 text-green-700" : m.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{m.status}</span></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openPwdModal(m)} className="px-3 py-1 rounded bg-yellow-50 border text-sm hover:bg-yellow-100">Reset Password</button>
                          <button onClick={() => openEditModal(m)} className="px-3 py-1 rounded border text-sm">Edit</button>
                          <button onClick={() => handleDelete(m)} className="px-3 py-1 rounded border text-sm text-red-600">Delete</button>
                          <button onClick={() => navigator.clipboard?.writeText(m.email)} className="px-3 py-1 rounded border text-sm">Copy Email</button>
                        </div>
                      </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-gray-500">Page {page} of {totalPages} · {data?.total ?? 0} total</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border rounded disabled:opacity-40 text-sm">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="px-3 py-1 border rounded disabled:opacity-40 text-sm">Next</button>
            </div>
          </div>
        </div>
      )}

      {showPwdModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closePwdModal}></div>
          <div className="bg-white rounded-lg p-6 z-10 w-[28rem]">
            <h2 className="text-lg font-semibold mb-4">Reset password for {selectedMember.fullName}</h2>
            <input
              type="password"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={closePwdModal} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={submitPasswordUpdate} disabled={!newPassword || pwdLoading} className="px-4 py-2 bg-blue-600 text-white rounded">{pwdLoading ? "Updating..." : "Update Password"}</button>
            </div>
          </div>
        </div>
      )}

      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeMemberModal}></div>
          <div className="bg-white rounded-lg p-6 z-10 w-[32rem] max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-semibold mb-4">{memberMode === "create" ? "Create Member" : `Edit ${selectedMember?.fullName || "Member"}`}</h2>

            <div className="grid grid-cols-2 gap-3">
              <input className="col-span-2 border px-3 py-2 rounded" placeholder="Full name" value={memberForm.fullName} onChange={(e) => setMemberForm((s:any) => ({ ...s, fullName: e.target.value }))} />
              <input className="col-span-1 border px-3 py-2 rounded" placeholder="Email" value={memberForm.email} onChange={(e) => setMemberForm((s:any) => ({ ...s, email: e.target.value }))} />
              <input className="col-span-1 border px-3 py-2 rounded" placeholder="Mobile" value={memberForm.mobile} onChange={(e) => setMemberForm((s:any) => ({ ...s, mobile: e.target.value }))} />
              <input className="col-span-2 border px-3 py-2 rounded" placeholder="Address line 1" value={memberForm.address.line1} onChange={(e) => setMemberForm((s:any) => ({ ...s, address: { ...s.address, line1: e.target.value } }))} />
              <input className="col-span-2 border px-3 py-2 rounded" placeholder="Address line 2" value={memberForm.address.line2} onChange={(e) => setMemberForm((s:any) => ({ ...s, address: { ...s.address, line2: e.target.value } }))} />
              <input className="col-span-1 border px-3 py-2 rounded" placeholder="City" value={memberForm.address.city} onChange={(e) => setMemberForm((s:any) => ({ ...s, address: { ...s.address, city: e.target.value } }))} />
              <input className="col-span-1 border px-3 py-2 rounded" placeholder="State" value={memberForm.address.state} onChange={(e) => setMemberForm((s:any) => ({ ...s, address: { ...s.address, state: e.target.value } }))} />
              <input className="col-span-1 border px-3 py-2 rounded" placeholder="Pincode" value={memberForm.address.pincode} onChange={(e) => setMemberForm((s:any) => ({ ...s, address: { ...s.address, pincode: e.target.value } }))} />
              <select className="col-span-1 border px-3 py-2 rounded" value={memberForm.role} onChange={(e) => setMemberForm((s:any) => ({ ...s, role: e.target.value }))}>
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
              <select className="col-span-1 border px-3 py-2 rounded" value={memberForm.status} onChange={(e) => setMemberForm((s:any) => ({ ...s, status: e.target.value }))}>
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              {memberMode === "create" && (
                <input className="col-span-2 border px-3 py-2 rounded" placeholder="Password (leave blank to auto-generate)" value={memberForm.password} onChange={(e) => setMemberForm((s:any) => ({ ...s, password: e.target.value }))} />
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={closeMemberModal} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={submitMemberForm} disabled={memberLoading} className="px-4 py-2 bg-blue-600 text-white rounded">{memberLoading ? "Saving..." : memberMode === "create" ? "Create" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
