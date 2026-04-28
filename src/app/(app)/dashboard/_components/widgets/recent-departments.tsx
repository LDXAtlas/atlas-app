"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";

interface Department {
  id: string;
  name: string;
  color: string;
  member_count: number;
}

interface RecentDepartmentsProps {
  departments: Department[];
}

export function RecentDepartments({ departments }: RecentDepartmentsProps) {
  const isEmpty = departments.length === 0;

  return (
    <div
      className="bg-white rounded-3xl p-6 h-full flex flex-col border border-[#E5E7EB]/50 transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)]"
      style={{
        boxShadow:
          "0 4px 20px -2px rgba(0,0,0,0.02), 0 1px 4px -1px rgba(0,0,0,0.02)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3
          className="text-[15px] text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          Departments
        </h3>
        <Link
          href="/directory/staff-management"
          className="text-[13px] text-[#5CE1A5] hover:underline"
          style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
        >
          View all &rarr;
        </Link>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
          <div
            className="size-12 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
          >
            <Building2 className="size-6 text-[#5CE1A5]" />
          </div>
          <p
            className="text-[14px] text-[#6B7280]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No departments yet
          </p>
          <Link
            href="/directory/staff-management"
            className="text-[13px] text-[#5CE1A5] mt-2 hover:underline"
            style={{
              fontFamily: "var(--font-source-sans)",
              fontWeight: 600,
            }}
          >
            Create your first department &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-[#F4F5F7] transition-colors"
            >
              <div
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: dept.color }}
              />
              <span
                className="text-[14px] text-[#2D333A] flex-1 truncate"
                style={{
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                }}
              >
                {dept.name}
              </span>
              <span
                className="text-[12px] text-[#9CA3AF] shrink-0"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {dept.member_count} member{dept.member_count !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
