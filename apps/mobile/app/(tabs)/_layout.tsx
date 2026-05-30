import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../context/AuthContext";
import DrawerMenu from "../../components/DrawerMenu";

function HamburgerButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.hamburger}>
      <View style={styles.bar} />
      <View style={[styles.bar, { width: 18 }]} />
      <View style={styles.bar} />
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hamburger = () => <HamburgerButton onPress={() => setDrawerOpen(true)} />;

  return (
    <>
      <DrawerMenu visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#1a56db",
          headerShown: true,
          headerStyle: { backgroundColor: "#1a56db" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
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
              <TouchableOpacity style={styles.notifBtn} onPress={() => {}}>
                <Ionicons name="notifications-outline" size={22} color="#fff" />
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
        {isAdmin ? (
          <Tabs.Screen
            name="members"
            options={{
              title: "Members",
              tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />,
              headerLeft: hamburger,
            }}
          />
        ) : (
          <Tabs.Screen name="members" options={{ href: null }} />
        )}

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
        {/* Members sub-pages (hidden) */}
        <Tabs.Screen name="members/create" options={{ href: null, title: "Create Member", headerLeft: hamburger }} />
        <Tabs.Screen name="members/[id]/edit" options={{ href: null, title: "Edit Member", headerLeft: hamburger }} />
        <Tabs.Screen name="members/[id]/reset-password" options={{ href: null, title: "Reset Password", headerLeft: hamburger }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  hamburger: { paddingHorizontal: 16, paddingVertical: 8, gap: 4, alignItems: "flex-start" },
  bar: { width: 22, height: 2.5, backgroundColor: "#fff", borderRadius: 2 },
  notifBtn: { paddingHorizontal: 16 },
});
