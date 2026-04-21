"use client";

import { Users, TrendingUp, UserPlus, UserMinus, BarChart3, PieChart } from "lucide-react";

interface Stats {
  total: number;
  active: number;
  inactive: number;
  visitors: number;
  newThisMonth: number;
}

export function AnalyticsView({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-8">
      {/* Stat Cards — real data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={stats.total}
          sub={`${stats.active} active`}
          icon={<Users className="size-5 text-[#3B82F6]" />}
          bgColor="#EFF6FF"
        />
        <StatCard
          label="Active Members"
          value={stats.active}
          sub={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% of total` : "0%"}
          icon={<TrendingUp className="size-5 text-[#5CE1A5]" />}
          bgColor="rgba(92, 225, 165, 0.08)"
        />
        <StatCard
          label="New This Month"
          value={stats.newThisMonth}
          sub="Added recently"
          icon={<UserPlus className="size-5 text-[#8B5CF6]" />}
          bgColor="#F5F3FF"
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          sub={`${stats.visitors} visitor${stats.visitors !== 1 ? "s" : ""}`}
          icon={<UserMinus className="size-5 text-[#F59E0B]" />}
          bgColor="#FFFBEB"
        />
      </div>

      {/* Placeholder chart sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderChart
          title="Membership Growth"
          description="Track how your congregation is growing month over month."
          icon={<BarChart3 className="size-5 text-[#3B82F6]" />}
        />
        <PlaceholderChart
          title="Department Breakdown"
          description="See how members are distributed across departments."
          icon={<PieChart className="size-5 text-[#8B5CF6]" />}
        />
      </div>

      <PlaceholderChart
        title="Engagement Overview"
        description="Understand attendance patterns, volunteer participation, and connection status across your congregation."
        icon={<TrendingUp className="size-5 text-[#5CE1A5]" />}
      />
    </div>
  );
}

function StatCard({ label, value, sub, icon, bgColor }: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide" style={{ fontFamily: "var(--font-poppins)" }}>
          {label}
        </span>
        <div className="size-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: bgColor }}>
          {icon}
        </div>
      </div>
      <p className="text-[28px] font-bold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
        {value}
      </p>
      <p className="text-[12px] text-[#9CA3AF] mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>
        {sub}
      </p>
    </div>
  );
}

function PlaceholderChart({ title, description, icon }: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-[15px] font-semibold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
            {title}
          </h3>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-[11px] font-medium text-[#5CE1A5]"
          style={{ fontFamily: "var(--font-poppins)", backgroundColor: "rgba(92, 225, 165, 0.08)" }}
        >
          Coming Soon
        </span>
      </div>
      <p className="text-[13px] text-[#6B7280] mb-6" style={{ fontFamily: "var(--font-source-sans)" }}>
        {description}
      </p>
      {/* Placeholder chart area */}
      <div className="h-48 bg-[#F4F5F7] rounded-xl flex items-center justify-center border border-[#E5E7EB] border-dashed">
        <div className="text-center">
          <div className="size-10 rounded-xl bg-white flex items-center justify-center mx-auto mb-2 shadow-sm">
            <BarChart3 className="size-5 text-[#D1D5DB]" />
          </div>
          <p className="text-[12px] text-[#9CA3AF]" style={{ fontFamily: "var(--font-source-sans)" }}>
            Chart will appear here
          </p>
        </div>
      </div>
    </div>
  );
}
