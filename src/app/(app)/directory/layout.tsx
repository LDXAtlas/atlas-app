"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Settings, BarChart3 } from "lucide-react";

const tabs = [
  { id: "people", label: "People", href: "/directory", icon: Users },
  { id: "staff", label: "Staff Management", href: "/directory/staff-management", icon: Settings },
  { id: "analytics", label: "Analytics", href: "/directory/analytics", icon: BarChart3 },
];

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show tabs on member detail pages
  const isDetailPage = /^\/directory\/[^/]+$/.test(pathname) && pathname !== "/directory/staff-management" && pathname !== "/directory/analytics";

  if (isDetailPage) {
    return <>{children}</>;
  }

  const activeTab = pathname === "/directory/staff-management" ? "staff"
    : pathname === "/directory/analytics" ? "analytics"
    : "people";

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-[#F4F5F7] p-1 rounded-2xl flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-all whitespace-nowrap ${
                  isActive ? "text-[#2D333A] bg-white shadow-sm" : "text-[#6B7280] hover:text-[#2D333A]"
                }`}
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <Icon className={`size-4 ${isActive ? "text-[#5CE1A5]" : "text-[#9CA3AF]"}`} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
