"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "User Approvals", href: "/dashboard/approvals" },
  { label: "Members", href: "/dashboard/members" },
  { label: "Product Approvals", href: "/dashboard/product-approvals" },
  { label: "Products", href: "/dashboard/products" },
  { label: "Ratings & Comments", href: "/dashboard/moderation" },
  { label: "Best Sellers Config", href: "/dashboard/ranking" },
  { label: "Menu Manager", href: "/dashboard/menu" },
  { label: "Push Notifications", href: "/dashboard/notifications" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-blue-800 text-white flex flex-col">
      <div className="p-6 text-2xl font-bold tracking-tight border-b border-blue-700">
        SCJYGM
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-6 py-3 text-sm font-medium hover:bg-blue-700 transition-colors ${
              pathname.startsWith(item.href) ? "bg-blue-700" : ""
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="m-4 py-2 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
      >
        Sign Out
      </button>
    </aside>
  );
}
