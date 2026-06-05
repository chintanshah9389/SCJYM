import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "expo-router";
import { brand, ui, shadows } from "../../lib/theme";
// @ts-ignore
import * as FileSystem from "expo-file-system";
import { fromByteArray } from "base64-js";

export default function MembersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const ROLES = user?.role === "SUPER_ADMIN" ? ["MEMBER", "ADMIN", "SUPER_ADMIN"] : ["MEMBER", "ADMIN"];
  const STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "SUSPENDED"];

  const { data, isLoading } = useQuery({
    queryKey: ["members", search, page, roleFilters.join(","), statusFilters.join(",")],
    enabled: !!user,
    queryFn: () => {
      const params: any = { q: search || undefined, page, limit: 20 };
      // If user selected exactly one role/status, let server filter. If multiple, we'll filter client-side.
      if (roleFilters.length === 1) params.role = roleFilters[0];
      if (statusFilters.length === 1) params.status = statusFilters[0];
      return api.get("/users", { params }).then((r) => r.data.data);
    },
  });

  const members = data?.items ?? [];
  const displayedMembers = useMemo(() => {
    return members.filter((m: any) => {
      if (roleFilters.length && !roleFilters.includes(m.role)) return false;
      if (statusFilters.length && !statusFilters.includes(m.status)) return false;
      return true;
    });
  }, [members, roleFilters, statusFilters]);
  const totalPages = data?.totalPages ?? 1;

  async function handleExport(fmt: "csv" | "xlsx") {
    setExporting(true);
    try {
      const params: any = { fmt };
      if (search) params.q = search;
      if (roleFilters.length === 1) params.role = roleFilters[0];
      if (statusFilters.length === 1) params.status = statusFilters[0];

      const res = await api.get("/users/export", { params, responseType: "arraybuffer" as any });

      // web: create blob and download
      if (Platform.OS === "web") {
        const blob = new Blob([res.data], { type: fmt === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `members.${fmt === "csv" ? "csv" : "xlsx"}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        Alert.alert("Export", "Download started");
        return;
      }

      // native: write file and share
      const u8 = new Uint8Array(res.data);
      const b64 = fromByteArray(u8);
      const ext = fmt === "csv" ? "csv" : "xlsx";
      const fileName = `members_${Date.now()}.${ext}`;
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: FileSystem.EncodingType.Base64 });

      try {
        await Share.share({ url: fileUri, title: `Members ${ext.toUpperCase()}` } as any);
      } catch (err) {
        // fallback: alert with path
        Alert.alert("Export saved", `File saved to ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert("Export failed", err?.message ?? "Failed to export");
    } finally {
      setExporting(false);
    }
  }

  function openCreate() {
    console.log("Navigate: create");
    router.push({ pathname: "(tabs)/members/create" } as any);
  }

  function openEdit(item: any) {
    console.log("Navigate: edit", item.id);
    router.push({ pathname: "(tabs)/members/[id]/edit", params: { id: item.id } } as any);
  }

  function openPwd(item: any) {
    console.log("Navigate: reset-password", item.id);
    router.push({ pathname: "(tabs)/members/[id]/reset-password", params: { id: item.id } } as any);
  }

  async function confirmDelete(item: any) {
    Alert.alert("Confirm", `Delete ${item.fullName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/users/${item.id}`);
            queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "members" });
            Alert.alert("Deleted", "User removed.");
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.detail?.message ?? err.message ?? "Failed to delete");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.header}>Members</Text>
        {isAdmin && (
          <TouchableOpacity onPress={openCreate} style={{ marginRight: 12 }}>
            <Text style={{ color: "#1a56db", fontWeight: "700" }}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

        <TextInput
        style={styles.search}
        placeholder="Search by name, email, mobile..."
        value={search}
        onChangeText={(v) => { setSearch(v); setPage(1); }}
      />

      {isAdmin && (
      <View style={{ marginHorizontal: 12 }}>
        <TouchableOpacity onPress={() => setShowFilters((s) => !s)} style={{ paddingVertical: 6 }}>
          <Text style={{ color: "#374151", fontWeight: "700" }}>Filters {showFilters ? "▴" : "▾"}</Text>
        </TouchableOpacity>
        {showFilters && (
          <>
            <Text style={styles.label}>Role</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => { setPage(1); setRoleFilters((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])); }}
                  style={[styles.filterChip, roleFilters.includes(r) && styles.filterChipActive]}
                >
                  <Text style={roleFilters.includes(r) ? { color: "#fff" } : undefined}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Status</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {STATUSES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => { setPage(1); setStatusFilters((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])); }}
                  style={[styles.filterChip, statusFilters.includes(s) && styles.filterChipActive]}
                >
                  <Text style={statusFilters.includes(s) ? { color: "#fff" } : undefined}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <View style={{ flexDirection: "row" }}>
                <TouchableOpacity onPress={() => { setRoleFilters([]); setStatusFilters([]); setPage(1); }} style={{ padding: 6 }}>
                  <Text style={{ color: "#6b7280" }}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row" }}>
                <TouchableOpacity onPress={() => handleExport("csv")} style={{ padding: 6, marginRight: 8 }}>
                  <Text style={{ color: brand.base, fontWeight: "700" }}>{exporting ? "Exporting..." : "Export CSV"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleExport("xlsx")} style={{ padding: 6 }}>
                  <Text style={{ color: brand.base, fontWeight: "700" }}>{exporting ? "Exporting..." : "Export XLSX"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color={brand.base} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayedMembers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.sub}>{item.email} · {item.mobile}</Text>
              {isAdmin && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => openPwd(item)} style={{ padding: 6 }}>
                    <Text style={{ color: "#b45309" }}>Reset PW</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(item)} style={{ padding: 6 }}>
                    <Text style={{ color: "#1a56db" }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={{ padding: 6 }}>
                    <Text style={{ color: "#ef4444" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No members found.</Text>}
        />
      )}

      <View style={styles.pagination}>
        <TouchableOpacity onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          <Text style={[styles.pageBtn, page <= 1 && styles.disabled]}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pageInfo}>Page {page}</Text>
        <TouchableOpacity onPress={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
          <Text style={[styles.pageBtn, page >= totalPages && styles.disabled]}>Next ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.pageBg },
  header: { fontSize: 23, fontWeight: "800", padding: 16, color: ui.text },
  search: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: ui.card,
    color: ui.text,
    ...shadows.soft,
  },
  input: {
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
  },
  card: {
    backgroundColor: ui.card,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  name: { fontSize: 15, fontWeight: "700", color: ui.text },
  sub: { fontSize: 13, color: ui.textMuted, marginTop: 4 },
  badge: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#1a56db" },
  empty: { textAlign: "center", marginTop: 40, color: ui.textMuted },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  noAccess: { color: "#6b7280", fontSize: 16 },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  pageBtn: { color: brand.base, fontSize: 16, fontWeight: "700" },
  disabled: { color: "#b9c4e4" },
  pageInfo: { color: ui.textMuted },
  label: { marginHorizontal: 12, marginTop: 8, color: "#334155", fontSize: 13, fontWeight: "700" },
  dropdownContainer: { marginHorizontal: 12, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  dropdownSelected: { color: "#1a56db", fontWeight: "700" },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: ui.border, backgroundColor: ui.card, marginRight: 8, marginBottom: 8 },
  filterChipActive: { backgroundColor: brand.base, borderColor: brand.base },
});
