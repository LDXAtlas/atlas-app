"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutGrid,
  Blocks,
  ClipboardList,
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
  HandHelping,
  Heart,
  Sparkles,
  Zap,
  UserPlus,
  ClipboardCheck,
  FileText,
} from "lucide-react";

// ─── Atlas AI Gradient Constants ─────────────────────────
const AI_GRADIENT = "linear-gradient(135deg, #5CE1A5, #8B5CF6)";
const AI_FROM = "#5CE1A5";
const AI_TO = "#8B5CF6";

// ─── Types ───────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface ModuleGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  isAI?: boolean;
  items: NavItem[];
}

// ─── Navigation data ─────────────────────────────────────
const topNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutGrid className="size-5" strokeWidth={1.5} /> },
  { label: "Ministry Hub", href: "/ministry-hub", icon: <Blocks className="size-5" strokeWidth={1.5} /> },
];

const modules: ModuleGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: <ClipboardList className="size-5" strokeWidth={1.5} />,
    color: "#3B82F6",
    items: [
      { label: "Announcements", href: "/workspace/announcements", icon: <Megaphone className="size-4" /> },
      { label: "My Tasks", href: "/workspace/tasks", icon: <CheckSquare className="size-4" /> },
      { label: "Team Huddles", href: "/workspace/huddles", icon: <Users className="size-4" /> },
      { label: "Project Boards", href: "/workspace/projects", icon: <Folder className="size-4" /> },
      { label: "Events", href: "/workspace/events", icon: <Calendar className="size-4" /> },
      { label: "Library", href: "/workspace/library", icon: <BookOpen className="size-4" /> },
      { label: "Calendar", href: "/workspace/calendar", icon: <Calendar className="size-4" /> },
    ],
  },
  {
    id: "serve",
    label: "Serve",
    icon: <HandHelping className="size-5" strokeWidth={1.5} />,
    color: "#10B981",
    items: [
      { label: "Onboarding", href: "/serve/onboarding", icon: <UserPlus className="size-4" /> },
      { label: "Scheduling", href: "/serve/scheduling", icon: <Calendar className="size-4" /> },
      { label: "Team Health", href: "/serve/team-health", icon: <Users className="size-4" /> },
    ],
  },
  {
    id: "care",
    label: "Care",
    icon: <Heart className="size-5" strokeWidth={1.5} />,
    color: "#EC4899",
    items: [
      { label: "Care Journal", href: "/care/care-journal", icon: <FileText className="size-4" /> },
      { label: "Follow-Ups", href: "/care/follow-ups", icon: <ClipboardCheck className="size-4" /> },
      { label: "Prayer Wall", href: "/care/prayer-wall", icon: <MessageCircle className="size-4" /> },
    ],
  },
  {
    id: "atlas-ai",
    label: "Atlas AI",
    icon: <Sparkles className="size-5" strokeWidth={1.5} />,
    color: AI_TO,
    isAI: true,
    items: [
      { label: "Atlas Copilot", href: "/atlas-ai/copilot", icon: <Sparkles className="size-4" /> },
      { label: "Workflows", href: "/atlas-ai/workflows", icon: <Zap className="size-4" /> },
    ],
  },
];

const bottomNav: NavItem[] = [
  { label: "Messages", href: "/messages", icon: <MessageCircle className="size-5" strokeWidth={1.5} /> },
  { label: "Directory", href: "/directory", icon: <Contact className="size-5" strokeWidth={1.5} /> },
  { label: "Settings", href: "/settings", icon: <Settings className="size-5" strokeWidth={1.5} /> },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/ministry-hub": "Ministry Hub",
  "/workspace/announcements": "Announcements",
  "/workspace/tasks": "My Tasks",
  "/workspace/huddles": "Team Huddles",
  "/workspace/projects": "Project Boards",
  "/workspace/events": "Events",
  "/workspace/library": "Library",
  "/workspace/calendar": "Calendar",
  "/serve/onboarding": "Onboarding",
  "/serve/scheduling": "Scheduling",
  "/serve/team-health": "Team Health",
  "/care/care-journal": "Care Journal",
  "/care/follow-ups": "Follow-Ups",
  "/care/prayer-wall": "Prayer Wall",
  "/atlas-ai/copilot": "Atlas Copilot",
  "/atlas-ai/workflows": "Workflows",
  "/messages": "Messages",
  "/directory": "Directory",
  "/settings": "Settings",
  "/settings/subscription": "Subscription",
};

// ─── Helpers ─────────────────────────────────────────────
function getModuleForPath(pathname: string): string | null {
  for (const mod of modules) {
    if (mod.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))) {
      return mod.id;
    }
  }
  return null;
}

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  // Check if it belongs to a module
  for (const mod of modules) {
    const item = mod.items.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
    if (item) {
      return [
        { label: mod.label, href: mod.items[0].href },
        { label: item.label, href: item.href },
      ];
    }
  }
  // Standalone pages
  const title = pageTitles[pathname];
  if (title) return [{ label: title, href: pathname }];
  return [{ label: "Dashboard", href: "/dashboard" }];
}

// ─── Shell ───────────────────────────────────────────────
interface AppShellProps {
  userName: string;
  children: React.ReactNode;
}

export function AppShell({ userName, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);
  const title = breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard";

  // Auto-expand the module that contains the active page
  const [openModules, setOpenModules] = useState<Set<string>>(() => {
    const active = getModuleForPath(pathname);
    return active ? new Set([active]) : new Set();
  });

  useEffect(() => {
    const active = getModuleForPath(pathname);
    if (active) {
      setOpenModules(new Set([active]));
    }
  }, [pathname]);

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => {
      if (prev.has(moduleId)) {
        return new Set();
      }
      return new Set([moduleId]);
    });
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const sidebarWidth = collapsed ? 80 : 260;

  return (
    <div className="flex min-h-screen bg-[#F4F5F7]">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-[#E5E7EB] overflow-hidden"
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 min-h-[80px] ${collapsed ? "px-0 justify-center" : "px-6"} py-6`}>
          <div className="size-10 rounded-xl bg-gradient-to-br from-[#5CE1A5] to-[#3DB882] flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-poppins)" }}>A</span>
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col min-w-0"
            >
              <span className="text-[#2D333A] font-semibold text-[14px] leading-tight" style={{ fontFamily: "var(--font-poppins)" }}>
                Atlas Church
              </span>
              <span className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-widest mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>
                Admin Portal
              </span>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 flex flex-col gap-[2px] overflow-y-auto pb-4 ${collapsed ? "px-2" : "px-4"}`}>
          {/* Top items */}
          {topNav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
          ))}

          <Divider collapsed={collapsed} />

          {/* Collapsible modules */}
          {modules.map((mod) => (
            <ModuleSection
              key={mod.id}
              module={mod}
              isOpen={openModules.has(mod.id)}
              onToggle={() => toggleModule(mod.id)}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}

          <Divider collapsed={collapsed} />

          {/* Bottom nav */}
          {bottomNav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-[#E5E7EB] px-4 py-4">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="size-9 rounded-full bg-gradient-to-br from-[#5CE1A5] to-[#3DB882] flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[#2D333A] text-[13px] font-semibold truncate" style={{ fontFamily: "var(--font-poppins)" }}>
                  {userName}
                </p>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1 text-[#6B7280] text-[12px] hover:text-red-500 transition-colors"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <LogOut className="size-3" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main content area */}
      <motion.div
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="flex-1 flex flex-col min-w-0"
      >
        {/* Topbar */}
        <header className="sticky top-0 z-40 h-16 flex items-center px-4 lg:px-6 bg-white border-b border-[#E5E7EB] shrink-0">
          {/* Sidebar collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`size-10 rounded-xl border shadow-sm flex items-center justify-center transition-all duration-300 ${
              collapsed
                ? "bg-[#5CE1A5] border-[#5CE1A5] text-white"
                : "bg-white border-gray-100 text-gray-400 hover:text-[#5CE1A5] hover:border-[#5CE1A5]"
            }`}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              <ChevronLeft className="size-5" />
            </motion.div>
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 ml-4">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <div key={`${idx}-${crumb.href}`} className="flex items-center gap-1.5">
                  {idx > 0 && (
                    <span className="text-[12px] text-[#9CA3AF]">/</span>
                  )}
                  <span
                    className={`text-[13px] whitespace-nowrap ${
                      isLast ? "font-semibold text-[#2D333A]" : "font-normal text-[#9CA3AF]"
                    }`}
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    {crumb.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex-1 flex justify-center px-8">
            <div className="relative w-full max-w-[400px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search people, tasks, events..."
                className="w-full bg-[#F4F5F7] border border-transparent hover:border-[#E5E7EB] focus:border-[#5CE1A5] rounded-xl py-2 pl-10 pr-4 text-[13px] text-[#2D333A] placeholder-[#9CA3AF] outline-none transition-all"
                style={{ fontFamily: "var(--font-source-sans)" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative text-[#6B7280] hover:text-[#5CE1A5] transition-colors p-2">
              <Bell className="size-5" />
              <span className="absolute top-1 right-1 size-4 bg-[#5CE1A5] text-white text-[9px] font-semibold rounded-full flex items-center justify-center border-2 border-white">
                3
              </span>
            </button>
            <div className="size-8 rounded-full bg-gradient-to-br from-[#5CE1A5] to-[#3DB882] flex items-center justify-center border border-[#E5E7EB] shadow-sm">
              <span className="text-white text-xs font-semibold" style={{ fontFamily: "var(--font-poppins)" }}>
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F4F5F7]">
          {children}
        </main>
      </motion.div>
    </div>
  );
}

// ─── Module Section with smooth animations ───────────────
function ModuleSection({
  module: mod,
  isOpen,
  onToggle,
  pathname,
  collapsed,
}: {
  module: ModuleGroup;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  collapsed: boolean;
}) {
  const hasActivePage = mod.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const isAI = mod.isAI;
  // Highlight the module header when it's open OR has an active sub-page
  const isHighlighted = isOpen || hasActivePage;

  return (
    <div className="relative">
      {/* Module context thread — 3px left border when highlighted */}
      {isHighlighted && (
        <div
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full z-10"
          style={{ background: isAI ? AI_GRADIENT : mod.color }}
        />
      )}

      {/* Module header */}
      <button
        onClick={onToggle}
        className={`flex items-center w-full px-4 py-3 gap-3 rounded-xl transition-all duration-200 group ${
          collapsed ? "justify-center px-2" : ""
        } ${isHighlighted ? "" : "text-[#6B7280] hover:bg-gray-50"}`}
        style={
          isHighlighted
            ? { backgroundColor: isAI ? `${AI_FROM}06` : `${mod.color}0A` }
            : undefined
        }
      >
        <div
          className="size-7 shrink-0 rounded-lg flex items-center justify-center transition-all duration-200"
          style={
            isHighlighted
              ? isAI
                ? { background: `linear-gradient(135deg, ${AI_FROM}14, ${AI_TO}14)` }
                : { backgroundColor: `${mod.color}14`, color: mod.color }
              : { color: "#6B7280" }
          }
        >
          <div
            className="size-5"
            style={
              isHighlighted && isAI
                ? { background: AI_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
                : isHighlighted
                ? { color: mod.color }
                : undefined
            }
          >
            {mod.icon}
          </div>
        </div>
        {!collapsed && (
          <>
            <span
              className="text-[13px] flex-1 text-left whitespace-nowrap overflow-hidden"
              style={{
                fontFamily: "var(--font-poppins)",
                fontWeight: isHighlighted ? 600 : 500,
                ...(isHighlighted && isAI
                  ? { background: AI_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
                  : isHighlighted
                  ? { color: mod.color }
                  : {}),
              }}
            >
              {mod.label}
            </span>
            <motion.div
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <ChevronRight
                className="size-4"
                style={{
                  color: isOpen && isAI ? AI_TO : isOpen ? mod.color : "#D1D5DB",
                }}
              />
            </motion.div>
          </>
        )}
      </button>

      {/* Sub-items with smooth height animation */}
      <AnimatePresence initial={false}>
        {!collapsed && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div
              className="ml-4 pl-4 border-l-2 space-y-0.5 mt-1 mb-1"
              style={{ borderColor: isAI ? `${AI_TO}20` : `${mod.color}20` }}
            >
              {mod.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative flex items-center w-full px-3 py-2 gap-3 rounded-lg text-[13px] overflow-hidden"
                  >
                    {/* Animated highlight background */}
                    <motion.div
                      className="absolute inset-0 rounded-lg"
                      initial={false}
                      animate={{
                        opacity: active ? 1 : 0,
                      }}
                      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                      style={
                        isAI
                          ? { background: `linear-gradient(135deg, ${AI_FROM}08, ${AI_TO}08)` }
                          : { backgroundColor: `${mod.color}08` }
                      }
                    />
                    <motion.div
                      className="relative size-4 shrink-0"
                      initial={false}
                      animate={{
                        color: active ? (isAI ? AI_FROM : mod.color) : "#6B7280",
                      }}
                      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                      style={
                        active && isAI
                          ? { background: AI_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
                          : undefined
                      }
                    >
                      {item.icon}
                    </motion.div>
                    <motion.span
                      className="relative whitespace-nowrap overflow-hidden"
                      initial={false}
                      animate={{
                        color: active ? (isAI ? AI_FROM : mod.color) : "#6B7280",
                        fontWeight: active ? 600 : 400,
                      }}
                      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                      style={{
                        fontFamily: "var(--font-poppins)",
                        ...(active && isAI
                          ? { background: AI_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
                          : {}),
                      }}
                    >
                      {item.label}
                    </motion.span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── NavLink ─────────────────────────────────────────────
function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 group ${
        collapsed ? "justify-center px-2" : ""
      } ${
        active
          ? "text-[#5CE1A5]"
          : "text-[#6B7280] hover:bg-gray-50"
      }`}
      style={active ? { backgroundColor: "rgba(92, 225, 165, 0.06)" } : undefined}
    >
      <div
        className="size-7 shrink-0 rounded-lg flex items-center justify-center transition-all duration-200"
        style={active ? { backgroundColor: "rgba(92, 225, 165, 0.08)", color: "#5CE1A5" } : { color: "#6B7280" }}
      >
        {item.icon}
      </div>
      {!collapsed && (
        <span
          className={`text-[13px] whitespace-nowrap overflow-hidden ${active ? "font-semibold" : "font-medium"}`}
          style={{
            fontFamily: "var(--font-poppins)",
            color: active ? "#5CE1A5" : undefined,
          }}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

// ─── Divider ─────────────────────────────────────────────
function Divider({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-auto my-2 w-8 h-px" style={{ background: "rgba(0,0,0,0.06)" }} />;
  }
  return (
    <div className="mx-3 my-3 relative">
      <div className="h-px" style={{ background: "linear-gradient(to right, transparent, #E5E7EB 30%, #E5E7EB 70%, transparent)" }} />
    </div>
  );
}
