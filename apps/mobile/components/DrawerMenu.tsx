/**
 * SlideDrawer — hamburger-style side drawer menu.
 * Usage: <DrawerMenu visible={open} onClose={() => setOpen(false)} />
 */
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { brand, ui } from "@/lib/theme";

const DRAWER_WIDTH = 280;
const { height } = Dimensions.get("window");

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

type NavLink = {
  label: string;
  icon: string;
  href: string;
  adminOnly?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { label: "Home", icon: "🏠", href: "/(tabs)" },
  { label: "Products", icon: "🛍️", href: "/(tabs)/products" },
  { label: "Cart", icon: "🛒", href: "/(tabs)/cart" },
  { label: "Profile", icon: "👤", href: "/(tabs)/profile" },
  { label: "Notifications", icon: "🔔", href: "/notifications" },
  { label: "Submit Product", icon: "📦", href: "/submit-product" },
  { label: "My Submissions", icon: "📋", href: "/my-submissions" },
];

const ADMIN_LINKS: NavLink[] = [
  { label: "Admin Hub", icon: "🛡️", href: "/admin/index", adminOnly: true },
  { label: "User Approvals", icon: "👤", href: "/admin/user-approvals", adminOnly: true },
  { label: "Product Approvals", icon: "📦", href: "/admin/product-approvals", adminOnly: true },
  { label: "Advertisements", icon: "📢", href: "/admin/advertisements", adminOnly: true },
  { label: "Menu Manager", icon: "📋", href: "/admin/menu-manager", adminOnly: true },
  { label: "Notification Push", icon: "🔔", href: "/admin/push-notifications", adminOnly: true },
  { label: "Ranking Config", icon: "⭐", href: "/admin/ranking-config", adminOnly: true },
];

export default function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function navigate(href: string) {
    onClose();
    setTimeout(() => router.push(href as any), 150);
  }

  async function handleLogout() {
    onClose();
    setTimeout(async () => {
      try {
        await logout();
      } catch {
        // Root auth guard will handle redirect after session is cleared.
      }
    }, 150);
  }

  if (!visible && Platform.OS !== "web") return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dark overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        {/* Header */}
        <View style={styles.drawerHeader}>
          <Image
            source={require("../assets/icon.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.appName}>SCJYGM</Text>
            {user && <Text style={styles.userName} numberOfLines={1}>{user.fullName}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Main nav */}
          <Text style={styles.section}>Navigation</Text>
          {NAV_LINKS.map((link) => (
            <TouchableOpacity key={link.href} style={styles.navItem} onPress={() => navigate(link.href)}>
              <Text style={styles.navIcon}>{link.icon}</Text>
              <Text style={styles.navLabel}>{link.label}</Text>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          ))}

          {/* Admin section */}
          {isAdmin && (
            <>
              <Text style={[styles.section, { marginTop: 16 }]}>Admin</Text>
              {ADMIN_LINKS.map((link) => (
                <TouchableOpacity key={link.href} style={[styles.navItem, styles.adminItem]} onPress={() => navigate(link.href)}>
                  <Text style={styles.navIcon}>{link.icon}</Text>
                  <Text style={[styles.navLabel, { color: "#7c3aed" }]}>{link.label}</Text>
                  <Text style={styles.navArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Sign out */}
          <TouchableOpacity style={[styles.navItem, styles.signOutItem]} onPress={handleLogout}>
            <Text style={styles.navIcon}>🚪</Text>
            <Text style={[styles.navLabel, { color: "#ef4444" }]}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,17,42,0.5)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: "100%",
    backgroundColor: ui.card,
    shadowColor: "#0f172a",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 24,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brand.base,
    padding: 20,
    paddingTop: Platform.OS === "android" ? 44 : 56,
    gap: 12,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  appName: { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: 0.8 },
  userName: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  closeBtn: { padding: 8 },
  closeText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  section: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7b8ab5",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2ff",
  },
  adminItem: { backgroundColor: brand.tint },
  signOutItem: { marginTop: 8, backgroundColor: "#fff1f2", borderBottomWidth: 0 },
  navIcon: { fontSize: 18, width: 32 },
  navLabel: { flex: 1, fontSize: 15, color: ui.text, fontWeight: "600" },
  navArrow: { fontSize: 18, color: "#c0c9e8" },
});
