"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Settings, BarChart3 } from "lucide-react";

const TABS = [
  { id: "people", label: "People", href: "/directory", icon: Users },
  { id: "staff", label: "Staff Management", href: "/directory/staff-management", icon: Settings },
  { id: "analytics", label: "Analytics", href: "/directory/analytics", icon: BarChart3 },
];

interface DirectoryShellProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  searchSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function DirectoryShell({
  title = "Directory",
  subtitle = "Manage every profile in your database.",
  actions,
  searchSlot,
  children,
}: DirectoryShellProps) {
  const pathname = usePathname();
  const activeTab =
    pathname === "/directory/staff-management"
      ? "staff"
      : pathname === "/directory/analytics"
        ? "analytics"
        : "people";

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            {title}
          </h1>
          <p
            className="text-[14px] text-[#6B7280] mt-1"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {subtitle}
          </p>
        </div>
        {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
      </div>

      {/* Tab bar + optional search slot */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="bg-[#F4F5F7] p-1 rounded-2xl flex items-center gap-1 self-start">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "text-[#2D333A] bg-white shadow-sm"
                    : "text-[#6B7280] hover:text-[#2D333A]"
                }`}
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <Icon className={`size-4 ${isActive ? "text-[#5CE1A5]" : "text-[#9CA3AF]"}`} />
                {tab.label}
              </Link>
            );
          })}
        </div>
        {searchSlot && <div className="flex items-center">{searchSlot}</div>}
      </div>

      {children}
    </div>
  );
}
