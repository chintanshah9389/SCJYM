import { getServerApiClient } from "@/lib/api";
import Link from "next/link";

export default async function DashboardPage() {
  let stats: Record<string, any> = {};
  try {
    const api = await getServerApiClient();
    const [usersRes, productsRes, pendingUsersRes, pendingProductsRes] = await Promise.all([
      api.get("/users?limit=1").catch(() => null),
      api.get("/products?limit=1").catch(() => null),
      api.get("/users?status=PENDING&limit=1").catch(() => null),
      api.get("/products?status=SUBMITTED&limit=1").catch(() => null),
    ]);
    stats.totalUsers = usersRes?.data?.data?.total ?? "—";
    stats.totalProducts = productsRes?.data?.data?.total ?? "—";
    stats.pendingUsers = pendingUsersRes?.data?.data?.total ?? "—";
    stats.pendingProducts = pendingProductsRes?.data?.data?.total ?? "—";
  } catch {}

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Total Members" value={stats.totalUsers} color="blue" />
        <StatCard label="Total Products" value={stats.totalProducts} color="green" />
        <StatCard label="Pending Approvals" value={stats.pendingUsers} color="yellow" href="/dashboard/approvals" />
        <StatCard label="Products to Review" value={stats.pendingProducts} color="orange" href="/dashboard/product-approvals" />
      </div>

      {/* Quick links grid */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            ["👤 User Approvals", "/dashboard/approvals"],
            ["📦 Product Approvals", "/dashboard/product-approvals"],
            ["🗂️ All Products", "/dashboard/products"],
            ["🔔 Push Notifications", "/dashboard/notifications"],
            ["📋 Menu Manager", "/dashboard/menu"],
            ["⭐ Rankings Config", "/dashboard/ranking"],
            ["💬 Moderation", "/dashboard/moderation"],
            ["👥 Members", "/dashboard/members"],
          ].map(([label, href]) => (
            <Link
              key={href as string}
              href={href as string}
              className="border border-gray-200 rounded-lg p-4 text-center text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: any;
  color: "blue" | "green" | "yellow" | "orange";
  href?: string;
}) {
  const colorMap = {
    blue: "text-blue-700",
    green: "text-green-700",
    yellow: "text-yellow-600",
    orange: "text-orange-600",
  };
  const card = (
    <div className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-4xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}
