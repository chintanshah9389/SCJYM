/**
 * Admin: Receipt Maker — Generate and share receipts with multi-user targeting
 * File: apps/mobile/app/admin/receipt-maker.tsx
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
} from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "@/lib/theme";

type AdminUser = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
};

export default function ReceiptMakerScreen() {
  const qc = useQueryClient();
  const [receiptNum] = useState(() => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `RCP-${timestamp}${random}`;
  });

  const [tab, setTab] = useState<"compose" | "preview">("compose");
  const [header, setHeader] = useState("Receipt Confirmation");
  const [bodyText, setBodyText] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");
  const [sendNotification, setSendNotification] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("New Receipt");
  const [notificationBody, setNotificationBody] = useState("Receipt generated for you");
  const [useSelectedUserName, setUseSelectedUserName] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-receipt-users"],
    queryFn: () =>
      api
        .get("/users?status=APPROVED&limit=100")
        .then((r) => r.data.data?.items ?? []),
  });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return users.filter((u) => {
      const name = (u.fullName ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      const phone = (u.phone ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [users, userSearch]);

  const recipientCount = selectedUserIds.size;

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedUserIds.has(u.id)),
    [users, selectedUserIds]
  );

  const selectedUserNames = useMemo(
    () => selectedUsers.map((u) => (u.fullName ?? "").trim()).filter(Boolean),
    [selectedUsers]
  );

  const previewUserName = useSelectedUserName ? selectedUserNames[0] : undefined;
  const stickyActionStyle =
    Platform.OS === "web"
      ? ({ position: "sticky", bottom: 84, zIndex: 20 } as any)
      : null;

  function buildReceiptMessage(message: string, userName?: string): string {
    const greeting = useSelectedUserName && userName ? `Hi ${userName},` : "Hi Member,";
    return `${greeting}\n\n${message.trim()}\n\nThanks,\nSCJYM Team`;
  }

  // Format receipt for display
  const receiptContent = generateReceiptText(receiptNum, header, bodyText, previewUserName);

  // Generate WhatsApp shareable text
  function generateReceiptText(
    num: string,
    headerText: string,
    body: string,
    userName?: string
  ): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN");
    const timeStr = now.toLocaleTimeString("en-IN");
    const receiptMessage = buildReceiptMessage(body || "Message will appear here.", userName);
    return `
${"═".repeat(40)}
           RECEIPT
${"═".repeat(40)}

Receipt #: ${num}
Date: ${dateStr}
Time: ${timeStr}

${headerText}

${receiptMessage}

${"═".repeat(40)}
Copyright (c) SCJYM
Generated: ${dateStr} ${timeStr}
${"═".repeat(40)}
    `.trim();
  }

  async function shareViaWhatsApp(userPhone?: string) {
    if (!bodyText.trim()) {
      Alert.alert("Validation", "Please add message to receipt body");
      return;
    }

    const message = receiptContent;
    const encodedMsg = encodeURIComponent(message);

    if (userPhone) {
      const cleanPhone = userPhone.replace(/\D/g, "");
      const deepLinkUrl = `whatsapp://send?phone=91${cleanPhone}&text=${encodedMsg}`;
      const webFallbackUrl = `https://wa.me/91${cleanPhone}?text=${encodedMsg}`;

      try {
        const supported = await Linking.canOpenURL(deepLinkUrl);
        if (supported) {
          await Linking.openURL(deepLinkUrl);
        } else {
          await Linking.openURL(webFallbackUrl);
        }
      } catch (e) {
        Alert.alert("Error", "Could not open WhatsApp");
      }
    } else {
      try {
        if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(receiptContent);
          Alert.alert("Copied", "Receipt text copied. Paste it in WhatsApp.");
          return;
        }
        await Share.share({ message: receiptContent, title: `Receipt ${receiptNum}` });
      } catch (e) {
        Alert.alert("Error", "Could not share receipt");
      }
    }
  }

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function shareReceiptPdf() {
    if (!bodyText.trim()) {
      Alert.alert("Validation", "Please add message to receipt body");
      return;
    }

    try {
      const sharedText = receiptContent;
      const logoUri = Image.resolveAssetSource(require("../../../assets/icon.png"))?.uri ?? "";
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-IN");
      const timeStr = now.toLocaleTimeString("en-IN");
      const messageForPdf = buildReceiptMessage(
        bodyText || "Message will appear here.",
        previewUserName
      );
      const safeMessageHtml = escapeHtml(messageForPdf).replace(/\n/g, "<br/>");
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                margin: 0;
                padding: 24px;
                background: #f5f7fb;
                color: #0f172a;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              }
              .card {
                width: 100%;
                max-width: 760px;
                margin: 0 auto;
                background: #ffffff;
                border: 1px solid #dbe5f0;
                border-radius: 20px;
                padding: 24px;
              }
              .head {
                display: flex;
                align-items: center;
                gap: 14px;
                padding-bottom: 16px;
                margin-bottom: 16px;
                border-bottom: 1px solid #e2e8f0;
              }
              .logo {
                width: 56px;
                height: 56px;
                border-radius: 12px;
                border: 1px solid #dbe5f0;
                object-fit: contain;
                background: #ffffff;
              }
              .brandTitle {
                margin: 0;
                font-size: 28px;
                line-height: 1.1;
                font-weight: 800;
                color: #1d4ed8;
                letter-spacing: 0.3px;
              }
              .brandSub {
                margin: 4px 0 0;
                font-size: 13px;
                color: #64748b;
                font-weight: 600;
              }
              .meta {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 16px;
              }
              .metaBox {
                border: 1px solid #dbe5f0;
                border-radius: 12px;
                padding: 10px 12px;
                background: #f8fafc;
              }
              .metaLabel {
                margin: 0;
                font-size: 11px;
                color: #64748b;
                font-weight: 700;
                text-transform: uppercase;
              }
              .metaValue {
                margin: 4px 0 0;
                font-size: 15px;
                color: #0f172a;
                font-weight: 700;
              }
              .headline {
                margin: 10px 0 12px;
                padding: 10px 12px;
                border-radius: 12px;
                background: #eef2ff;
                color: #1e3a8a;
                font-size: 18px;
                font-weight: 800;
              }
              .msg {
                border: 1px solid #dbe5f0;
                border-radius: 12px;
                padding: 14px;
                background: #ffffff;
                font-size: 14px;
                line-height: 1.7;
                color: #111827;
                white-space: normal;
              }
              .raw {
                margin-top: 16px;
                border-radius: 12px;
                border: 1px dashed #cbd5e1;
                background: #f8fafc;
                padding: 12px;
                font-family: "Courier New", monospace;
                font-size: 12px;
                line-height: 1.45;
                white-space: pre-wrap;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="head">
                ${logoUri ? `<img class="logo" src="${logoUri}" alt="SCJYM logo" />` : ""}
                <div>
                  <p class="brandTitle">SCJYM</p>
                  <p class="brandSub">Official Receipt</p>
                </div>
              </div>

              <div class="meta">
                <div class="metaBox">
                  <p class="metaLabel">Receipt Number</p>
                  <p class="metaValue">${escapeHtml(receiptNum)}</p>
                </div>
                <div class="metaBox">
                  <p class="metaLabel">Generated</p>
                  <p class="metaValue">${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</p>
                </div>
              </div>

              <div class="headline">${escapeHtml(header || "Receipt Confirmation")}</div>
              <div class="msg">${safeMessageHtml}</div>

              <div class="raw">${escapeHtml(sharedText)}</div>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === "web") {
        await Share.share({
          title: `Receipt ${receiptNum}`,
          message: `Receipt ${receiptNum}`,
          url: uri,
        } as any);
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
          throw new Error("Native sharing is not available on this device");
        }

        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Share Receipt ${receiptNum}`,
          UTI: "com.adobe.pdf",
        });
      }

      if (selectedUserIds.size > 0) {
        const targetUserIds = Array.from(selectedUserIds);
        await api.post("/admin/notifications/push", {
          title: `Receipt ${receiptNum}`,
          body: sharedText,
          targetUserIds,
          receiptData: {
            receiptNum,
            header,
            body: bodyText,
            formattedText: sharedText,
            generatedAt: new Date().toISOString(),
            recipients: targetUserIds,
          },
        });
        setStatusMsg(`Success: Shared and added to notifications for ${targetUserIds.length} recipient(s).`);
      }
    } catch {
      Alert.alert("Error", "Could not create/share PDF. Falling back to text share.");
      await shareViaWhatsApp();
    }
  }

  async function handleSendReceipt() {
    if (!bodyText.trim()) {
      setStatusMsg("Validation: Please add message to receipt body.");
      Alert.alert("Validation", "Please add message to receipt body");
      return;
    }
    if (selectedUserIds.size === 0) {
      setStatusMsg("Validation: Please select at least one recipient.");
      Alert.alert("Validation", "Please select at least one recipient");
      return;
    }
    setStatusMsg("Sending receipt...");
    try {
      await sendReceiptMut.mutateAsync();
    } catch {
      // Error UI handled in mutation onError callback.
    }
  }

  const sendReceiptMut = useMutation({
    mutationFn: async () => {
      if (!bodyText.trim()) throw new Error("Receipt body is required");
      if (selectedUserIds.size === 0) throw new Error("Select at least one recipient");

      const targetUserIds = Array.from(selectedUserIds);
      const primarySelectedName = useSelectedUserName ? selectedUserNames[0] : undefined;
      const selectedNamesForTitle = selectedUserNames.slice(0, 2).join(", ");
      const selectedSuffix = selectedUserNames.length > 2 ? ` +${selectedUserNames.length - 2}` : "";
      const generatedPushTitle = selectedNamesForTitle
        ? `Receipt for ${selectedNamesForTitle}${selectedSuffix}`
        : "New Receipt";
      const generatedPushBody = generateReceiptText(
        receiptNum,
        header,
        bodyText,
        primarySelectedName
      );

      const receipt = {
        receiptNum,
        header,
        body: bodyText,
        formattedText: generatedPushBody,
        formattedBody: buildReceiptMessage(bodyText, primarySelectedName),
        greetingMode: useSelectedUserName ? "selected-user" : "generic",
        generatedAt: new Date().toISOString(),
        recipients: targetUserIds,
      };

      // If sending notification, include receipt in push payload
      if (sendNotification) {
        return api.post("/admin/notifications/push", {
          title: notificationTitle.trim() || generatedPushTitle,
          body: notificationBody.trim() || generatedPushBody,
          targetUserIds,
          receiptData: receipt,
        });
      }

      // Otherwise just store receipt
      return api.post("/admin/receipts", receipt);
    },
    onSuccess: (response) => {
      setStatusMsg(`Success: Receipt sent to ${selectedUserIds.size} recipient(s).`);
      Alert.alert("Success", `Receipt sent to ${selectedUserIds.size} recipient(s)`);
      setBodyText("");
      setSelectedUserIds(new Set());
      setHeader("Receipt Confirmation");
      setSendNotification(false);
      setUseSelectedUserName(true);
      qc.invalidateQueries({ queryKey: ["admin-receipt-users"] });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.error?.message ??
        e?.response?.data?.detail?.error?.message ??
        e?.response?.data?.detail?.message ??
        e?.response?.data?.detail ??
        e?.message ??
        "Failed to send receipt.";
      setStatusMsg(`Error: ${msg}`);
      Alert.alert("Error", msg);
    },
  });

  return (
    <View style={styles.root}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === "compose" && styles.tabActive]}
          onPress={() => setTab("compose")}
        >
          <Text style={[styles.tabText, tab === "compose" && styles.tabTextActive]}>
            📝 Compose
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "preview" && styles.tabActive]}
          onPress={() => setTab("preview")}
        >
          <Text style={[styles.tabText, tab === "preview" && styles.tabTextActive]}>
            👁️ Preview
          </Text>
        </TouchableOpacity>
      </View>

      {/* Compose Tab */}
      {tab === "compose" && (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {statusMsg ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMsg}</Text>
            </View>
          ) : null}
          {/* Receipt Metadata */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt Info</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Receipt #</Text>
              <Text style={styles.infoValue}>{receiptNum}</Text>
            </View>
          </View>

          {/* Header */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Header Message</Text>
            <TextInput
              style={styles.input}
              value={header}
              onChangeText={setHeader}
              placeholder="e.g., Receipt Confirmation"
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Body */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt Body</Text>
            <TextInput
              style={[styles.input, styles.inputLarge]}
              value={bodyText}
              onChangeText={setBodyText}
              placeholder={
                "Enter your complete message.\nIt will be sent as:\n\nHi {{user}}\n\n<your message>\n\nThanks"
              }
              multiline
              numberOfLines={8}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={styles.sectionTitle}>Show Selected User Name</Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  useSelectedUserName && styles.toggleActive,
                ]}
                onPress={() => setUseSelectedUserName(!useSelectedUserName)}
              >
                <View
                  style={[
                    styles.toggleBall,
                    useSelectedUserName && styles.toggleBallActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
              {useSelectedUserName
                ? "Yes: message starts with selected user name (Hi {user})."
                : "No: a generic greeting will be used."}
            </Text>
          </View>

          {/* Recipients */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Recipients ({recipientCount} selected)
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, or phone..."
              value={userSearch}
              onChangeText={setUserSearch}
            />
            {usersLoading ? (
              <ActivityIndicator color={brand.base} />
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={(u) => u.id}
                scrollEnabled={false}
                renderItem={({ item: u }) => (
                  <TouchableOpacity
                    style={styles.userItem}
                    onPress={() => {
                      const newSet = new Set(selectedUserIds);
                      if (newSet.has(u.id)) {
                        newSet.delete(u.id);
                      } else {
                        newSet.add(u.id);
                      }
                      setSelectedUserIds(newSet);
                    }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selectedUserIds.has(u.id) && styles.checkboxActive,
                      ]}
                    >
                      {selectedUserIds.has(u.id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.fullName || "Unknown"}</Text>
                      <Text style={styles.userMeta}>
                        {u.email}
                        {u.phone ? ` • ${u.phone}` : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* Notification Option */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={styles.sectionTitle}>Send as Push Notification</Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  sendNotification && styles.toggleActive,
                ]}
                onPress={() => setSendNotification(!sendNotification)}
              >
                <View
                  style={[
                    styles.toggleBall,
                    sendNotification && styles.toggleBallActive,
                  ]}
                />
              </TouchableOpacity>
            </View>

            {sendNotification && (
              <>
                <TextInput
                  style={styles.input}
                  value={notificationTitle}
                  onChangeText={setNotificationTitle}
                  placeholder="Notification title"
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={notificationBody}
                  onChangeText={setNotificationBody}
                  placeholder="Notification body"
                  multiline
                  numberOfLines={2}
                />
              </>
            )}
          </View>

          <View style={[styles.actionCard, stickyActionStyle]}>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  void shareReceiptPdf();
                }}
                disabled={sendReceiptMut.isPending}
              >
                <Text style={styles.btnSecondaryText}>📄 Share PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, sendReceiptMut.isPending && { opacity: 0.7 }]}
                onPress={() => { void handleSendReceipt(); }}
                disabled={sendReceiptMut.isPending}
              >
                {sendReceiptMut.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>
                    {sendNotification ? "📤 Send + Notify" : "📤 Send Receipts"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Preview Tab */}
      {tab === "preview" && (
        <ScrollView contentContainerStyle={styles.preview}>
          <View style={styles.receiptPreview}>
            <View style={styles.receiptHeaderRow}>
              <Image
                source={require("../../../assets/icon.png")}
                style={styles.receiptLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.brandTitle}>SCJYM</Text>
                <Text style={styles.brandSubtitle}>Official Receipt</Text>
              </View>
            </View>
            <Text style={styles.receiptText}>{receiptContent}</Text>
          </View>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { marginTop: 16 }]}
            onPress={() => {
              void shareReceiptPdf();
            }}
            disabled={sendReceiptMut.isPending}
          >
            <Text style={styles.btnText}>📄 Share via WhatsApp (PDF)</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.pageBg },
  tabBar: {
    flexDirection: "row",
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: brand.base },
  tabText: { fontSize: 14, fontWeight: "600", color: ui.textMuted },
  tabTextActive: { color: brand.base },
  body: { padding: 16, paddingBottom: 110 },
  statusBox: {
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  statusText: { color: "#1f2937", fontSize: 13, fontWeight: "600" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: ui.text, marginBottom: 8 },
  input: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: ui.text,
  },
  inputLarge: { minHeight: 100 },
  infoBox: { backgroundColor: "#eef2ff", borderRadius: 12, padding: 12 },
  infoLabel: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  infoValue: { fontSize: 18, fontWeight: "700", color: brand.base, marginTop: 4 },
  searchInput: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: ui.text,
    marginBottom: 12,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ui.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: ui.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: brand.base, borderColor: brand.base },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: "600", color: ui.text },
  userMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  hintText: { marginTop: 4, fontSize: 12, color: ui.textMuted },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#d1d5db",
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: { backgroundColor: brand.base },
  toggleBall: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignSelf: "flex-start" },
  toggleBallActive: { alignSelf: "flex-end" },
  actionCard: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  actionRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: brand.base, ...shadows.soft },
  btnSecondary: { backgroundColor: ui.card, borderWidth: 1, borderColor: ui.border },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnSecondaryText: { color: brand.base, fontWeight: "700", fontSize: 14 },
  preview: { padding: 16, paddingBottom: 130 },
  receiptPreview: {
    backgroundColor: ui.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    ...shadows.card,
  },
  receiptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
  },
  receiptLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  brandTitle: { fontSize: 20, fontWeight: "800", color: brand.base },
  brandSubtitle: { fontSize: 12, color: ui.textMuted, fontWeight: "600" },
  receiptText: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 12,
    color: ui.text,
    lineHeight: 18,
  },
});
