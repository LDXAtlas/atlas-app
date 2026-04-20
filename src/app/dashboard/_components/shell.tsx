"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import {
  LayoutGrid,
  CheckSquare,
  Users,
  Folder,
  Megaphone,
  BookOpen,
  Calendar,
  MessageCircle,
  Contact,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Bell,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutGrid className="size-5" /> },
  { label: "My Tasks", href: "/dashboard/tasks", icon: <CheckSquare className="size-5" /> },
  { label: "Team Huddles", href: "/dashboard/huddles", icon: <Users className="size-5" /> },
  { label: "Project Boards", href: "/dashboard/projects", icon: <Folder className="size-5" /> },
  { label: "Announcements", href: "/dashboard/announcements", icon: <Megaphone className="size-5" /> },
  { label: "Library", href: "/dashboard/library", icon: <BookOpen className="size-5" /> },
  { label: "Calendar", href: "/dashboard/calendar", icon: <Calendar className="size-5" /> },
];

const secondaryNav: NavItem[] = [
  { label: "Messages", href: "/dashboard/messages", icon: <MessageCircle className="size-5" /> },
  { label: "Directory", href: "/dashboard/directory", icon: <Contact className="size-5" /> },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/tasks": "My Tasks",
  "/dashboard/huddles": "Team Huddles",
  "/dashboard/projects": "Project Boards",
  "/dashboard/announcements": "Announcements",
  "/dashboard/library": "Library",
  "/dashboard/calendar": "Calendar",
  "/dashboard/messages": "Messages",
  "/dashboard/directory": "Directory",
  "/dashboard/settings": "Settings",
};

interface AppShellProps {
  userName: string;
  children: React.ReactNode;
}

export function AppShell({ userName, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Dashboard";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const sidebarWidth = collapsed ? 80 : 260;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border transition-all duration-300"
        style={{ width: sidebarWidth, backgroundColor: "var(--sidebar-bg)" }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 min-h-[72px] ${collapsed ? "px-0 justify-center" : "px-5"} py-5`}>
          <div className="size-9 rounded-lg bg-mint/10 flex items-center justify-center shrink-0">
            <span className="text-mint font-bold text-lg" style={{ fontFamily: "var(--font-poppins)" }}>A</span>
          </div>
          {!collapsed && (
            <span className="text-foreground font-semibold text-[15px] whitespace-nowrap" style={{ fontFamily: "var(--font-poppins)" }}>
              Atlas
            </span>
          )}
        </div>

        {/* Main Navigation */}
        <nav className={`flex-1 mt-2 flex flex-col gap-0.5 overflow-y-auto ${collapsed ? "px-2" : "px-3"}`}>
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
          ))}

          <div className="mx-3 my-3 h-px bg-border" />

          {secondaryNav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
          ))}

          <div className="mx-3 my-3 h-px bg-border" />

          <NavLink
            item={{ label: "Settings", href: "/dashboard/settings", icon: <Settings className="size-5" /> }}
            active={isActive("/dashboard/settings")}
            collapsed={collapsed}
          />
        </nav>

        {/* User section */}
        <div className="border-t border-border px-3 py-4">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="size-9 rounded-full bg-mint/20 flex items-center justify-center shrink-0">
              <span className="text-mint text-sm font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-[13px] font-medium truncate" style={{ fontFamily: "var(--font-poppins)" }}>
                  {userName}
                </p>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1 text-muted text-[11px] hover:text-mint transition-colors"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <LogOut className="size-3" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-6 -right-3 size-6 rounded-full border border-border flex items-center justify-center text-muted hover:text-mint hover:border-mint transition-colors"
          style={{ backgroundColor: "var(--sidebar-bg)" }}
        >
          {collapsed ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
        </button>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300" style={{ marginLeft: sidebarWidth }}>
        {/* Topbar */}
        <header className="sticky top-0 z-40 h-16 flex items-center px-6 border-b border-border shrink-0" style={{ backgroundColor: "var(--topbar-bg)" }}>
          <h1 className="text-foreground text-[18px] font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
            {title}
          </h1>

          <div className="flex-1 flex justify-center px-8">
            <div className="relative w-full max-w-[400px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
              <input
                type="text"
                placeholder="Search people, tasks, events..."
                className="w-full bg-[#0F1112] border border-border rounded-xl py-2 pl-10 pr-4 text-[13px] text-foreground placeholder-muted outline-none focus:border-mint transition-colors"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative text-muted hover:text-mint transition-colors p-2">
              <Bell className="size-5" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-mint rounded-full" />
            </button>
            <div className="size-8 rounded-full bg-mint/20 flex items-center justify-center">
              <span className="text-mint text-sm font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--content-bg)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-mint/10 text-mint"
          : "text-muted hover:bg-[#1A1D1F] hover:text-foreground"
      }`}
    >
      <div className={`shrink-0 ${active ? "text-mint" : "text-muted group-hover:text-foreground"}`}>
        {item.icon}
      </div>
      {!collapsed && (
        <span
          className={`text-[13px] whitespace-nowrap ${active ? "font-semibold" : "font-medium"}`}
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}
