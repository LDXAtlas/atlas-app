"use client";

import { Users, UserCheck, Folder, Armchair } from "lucide-react";
import { motion } from "motion/react";

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

// Animation variants for the staggering effect
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring" as const, // Fixed: locks the type to exactly "spring"
      stiffness: 300,
      damping: 24,
    }
  },
};

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
      className="bg-white rounded-3xl p-3 h-full flex flex-col border border-[#E5E7EB]/50 transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)] overflow-hidden relative"
      style={{
        boxShadow:
          "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
      }}
    >
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex justify-between items-stretch gap-2.5 flex-1"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.key}
              variants={itemVariants}
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-2 p-3 rounded-2xl relative overflow-hidden group cursor-default"
              style={{ backgroundColor: `${stat.color}08` }}
            >
              {/* Subtle animated background gradient on hover */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ 
                  background: `radial-gradient(circle at center, ${stat.color}15 0%, transparent 70%)` 
                }}
              />
              
              <div className="size-[46px] rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5 bg-white shadow-sm border border-white/50 relative z-10 shrink-0">
                <Icon
                  className="size-6"
                  style={{ color: stat.color }}
                  strokeWidth={2}
                />
              </div>
              
              <div className="text-center relative z-10 flex flex-col items-center mt-1 w-full">
                <span
                  className="text-[26px] leading-none tracking-[-0.03em] truncate w-full"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 700,
                    color: "#2D333A",
                  }}
                >
                  {values[stat.key]}
                </span>
                <span
                  className="text-[13px] text-[#6B7280] mt-1 font-medium tracking-wide truncate w-full"
                  style={{
                    fontFamily: "var(--font-source-sans)",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}