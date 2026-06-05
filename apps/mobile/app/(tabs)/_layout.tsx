import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import DrawerMenu from "../../components/DrawerMenu";
import { shadows } from "../../lib/theme";
import { useAppTheme } from "../../context/ThemeContext";

function HamburgerButton({ onPress }: { onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} style={styles.hamburger}>
      <View style={[styles.bar, { backgroundColor: theme.ui.card }]} />
      <View style={[styles.bar, { width: 18, backgroundColor: theme.ui.card }]} />
      <View style={[styles.bar, { backgroundColor: theme.ui.card }]} />
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hamburger = () => <HamburgerButton onPress={() => setDrawerOpen(true)} />;

  const gradientHeader = () => (
    <LinearGradient
      colors={theme.brand.gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );

  const gradientTabBar = () => (
    <LinearGradient
      colors={theme.brand.gradients.tabBar}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );

  return (
    <>
      <DrawerMenu visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.brand.base,
          tabBarInactiveTintColor: theme.ui.textMuted,
          tabBarStyle: [styles.tabBar, { borderColor: theme.ui.border }],
          tabBarLabelStyle: styles.tabLabel,
          tabBarBackground: gradientTabBar,
          headerShown: true,
          headerStyle: styles.header,
          headerBackground: gradientHeader,
          headerTintColor: theme.ui.card,
          headerTitleStyle: styles.headerTitle,
        }}
      >
        {/* ── Visible tabs ─────────────────────────────── */}
        <Tabs.Screen
          name="index"
          options={{
            title: "SCJYGM",
            tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
            headerLeft: hamburger,
            headerRight: () => (
              <TouchableOpacity
                style={[styles.notifBtn, { backgroundColor: theme.brand.soft }]}
                onPress={() => {}}
              >
                <Ionicons name="notifications-outline" size={22} color={theme.ui.card} />
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: "Products",
            tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={22} color={color} />,
            headerLeft: hamburger,
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: "Cart",
            tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={22} color={color} />,
            headerLeft: hamburger,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
            headerLeft: hamburger,
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: "Members",
            tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />,
            headerLeft: hamburger,
          }}
        />

        {/* ── Hidden screens (keep tab bar visible) ───── */}
        <Tabs.Screen
          name="product/[id]"
          options={{ href: null, title: "Product", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="notifications"
          options={{ href: null, title: "Notifications", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="submit-product"
          options={{ href: null, title: "Submit Product", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="my-submissions"
          options={{ href: null, title: "My Submissions", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="video"
          options={{ href: null, title: "Video", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/index"
          options={{ href: null, title: "Admin Panel", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/user-approvals"
          options={{ href: null, title: "User Approvals", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/product-approvals"
          options={{ href: null, title: "Product Approvals", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/moderation"
          options={{ href: null, title: "Comment Moderation", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/push-notifications"
          options={{ href: null, title: "Push Notifications", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/menu-manager"
          options={{ href: null, title: "Menu Manager", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/ranking-config"
          options={{ href: null, title: "Ranking Config", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/advertisements"
          options={{ href: null, title: "Advertisements", headerLeft: hamburger }}
        />
        <Tabs.Screen
          name="admin/receipt-maker"
          options={{ href: null, title: "Receipt Maker", headerLeft: hamburger }}
        />
        {/* Members sub-pages (hidden) */}
        <Tabs.Screen name="members/create" options={{ href: null, title: "Create Member", headerLeft: hamburger }} />
        <Tabs.Screen name="members/[id]/edit" options={{ href: null, title: "Edit Member", headerLeft: hamburger }} />
        <Tabs.Screen name="members/[id]/reset-password" options={{ href: null, title: "Reset Password", headerLeft: hamburger }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "transparent",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...shadows.soft,
  },
  headerTitle: {
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 0.3,
  },
  tabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    height: 66,
    borderRadius: 22,
    paddingBottom: 8,
    paddingTop: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#f7dfe3",
    borderTopWidth: 0,
    ...shadows.card,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  hamburger: { paddingHorizontal: 16, paddingVertical: 8, gap: 4, alignItems: "flex-start" },
  bar: { width: 22, height: 2.5, borderRadius: 2 },
  notifBtn: {
    marginRight: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(231,96,120,0.92)",
  },
});
