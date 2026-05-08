"use client";

import { Users, UserCheck, Building, Armchair } from "lucide-react";
import { motion } from "motion/react";

interface StatsOverviewProps {
  totalMembers: number;
  activeMembers: number;
  departmentCount: number;
  seatLimit: number;
}

const stats = [
  { key: "total", label: "Total Members", icon: Users, color: "#5CE1A5" },
  { key: "active", label: "Active Members", icon: UserCheck, color: "#3B82F6" },
  { key: "departments", label: "Departments", icon: Building, color: "#8B5CF6" },
  { key: "seats", label: "Staff Seats", icon: Armchair, color: "#F59E0B" },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { 
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 }
  },
};

export function StatsOverview({ totalMembers, activeMembers, departmentCount, seatLimit }: StatsOverviewProps) {
  const values: Record<string, string> = {
    total: String(totalMembers),
    active: String(activeMembers),
    departments: String(departmentCount),
    seats: `${Math.min(totalMembers, seatLimit)} / ${seatLimit}`,
  };

  return (
    <div
      className="bg-white rounded-3xl p-4 h-full flex flex-col border border-[#E5E7EB]/50 transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)] overflow-hidden relative"
      style={{ boxShadow: "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)" }}
    >
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        // Changed to a 2x2 grid so it fits beautifully in the sidebar
        className="grid grid-cols-2 gap-3 flex-1"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.key}
              variants={itemVariants}
              className="flex flex-col items-center justify-center p-3 rounded-2xl relative overflow-hidden group cursor-default text-center"
              style={{ backgroundColor: `${stat.color}08` }}
            >
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${stat.color}15 0%, transparent 70%)` }}
              />
              
              <div className="size-[42px] rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5 bg-white shadow-sm border border-white/50 relative z-10 shrink-0 mb-2">
                <Icon className="size-5" style={{ color: stat.color }} strokeWidth={2} />
              </div>
              
              <div className="relative z-10 w-full px-1">
                <span
                  className="block text-[22px] leading-none tracking-[-0.03em] truncate"
                  style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, color: "#2D333A" }}
                >
                  {values[stat.key]}
                </span>
                {/* Removed truncate here so words like "Total Members" can wrap if needed */}
                <span
                  className="block text-[12px] text-[#6B7280] mt-1 font-medium tracking-wide leading-tight"
                  style={{ fontFamily: "var(--font-source-sans)" }}
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