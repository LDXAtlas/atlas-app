"use client";

import { Users, UserCheck, Folder, Armchair } from "lucide-react";

interface StatsOverviewProps {
  totalMembers: number;
  activeMembers: number;
  departmentCount: number;
  seatLimit: number;
}

const stats = [
  {
    key: "total",
    label: "Total Members",
    icon: Users,
    color: "#5CE1A5",
  },
  {
    key: "active",
    label: "Active Members",
    icon: UserCheck,
    color: "#3B82F6",
  },
  {
    key: "departments",
    label: "Departments",
    icon: Folder,
    color: "#8B5CF6",
  },
  {
    key: "seats",
    label: "Staff Seats",
    icon: Armchair,
    color: "#F59E0B",
  },
] as const;

export function StatsOverview({
  totalMembers,
  activeMembers,
  departmentCount,
  seatLimit,
}: StatsOverviewProps) {
  const values: Record<string, string> = {
    total: String(totalMembers),
    active: String(activeMembers),
    departments: String(departmentCount),
    seats: `${Math.min(totalMembers, seatLimit)} / ${seatLimit}`,
  };

  return (
    <div
      className="bg-white rounded-3xl p-2.5 h-full flex flex-col border border-[#E5E7EB]/50 transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)]"
      style={{
        boxShadow:
          "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
      }}
    >
      <div className="flex justify-between items-center gap-1.5 flex-1">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className="flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all group h-full"
              style={{ backgroundColor: `${stat.color}15` }}
            >
              <div className="size-[50px] rounded-md flex items-center justify-center transition-all group-hover:-translate-y-1 group-hover:shadow-md">
                <Icon
                  className="size-8"
                  style={{ color: stat.color }}
                  strokeWidth={2.5}
                />
              </div>
              <span
                className="text-[22px] leading-none tracking-tight"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 700,
                  color: stat.color,
                }}
              >
                {values[stat.key]}
              </span>
              <span
                className="text-[12px] text-[#6B7280] truncate max-w-full px-1 text-center"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 500,
                }}
              >
                {stat.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
