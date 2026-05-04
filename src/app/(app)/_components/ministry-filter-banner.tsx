"use client";

import Link from "next/link";
import { Filter, X, Blocks } from "lucide-react";
import { getIconByName } from "@/lib/icons";

interface MinistryFilterBannerProps {
  ministry: { id: string; name: string; color: string; icon: string };
  /** The page path WITHOUT the ?ministry= param — used by the Clear link. */
  basePath: string;
}

export function MinistryFilterBanner({
  ministry,
  basePath,
}: MinistryFilterBannerProps) {
  const Icon = getIconByName(ministry.icon);
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border mb-4"
      style={{
        backgroundColor: `${ministry.color}0F`,
        borderColor: `${ministry.color}33`,
      }}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6B7280]" style={{ fontFamily: "var(--font-poppins)" }}>
        <Filter className="size-3.5" />
        Filtering by
      </div>
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] font-semibold text-white"
        style={{
          fontFamily: "var(--font-poppins)",
          backgroundColor: ministry.color,
        }}
      >
        <Icon className="size-3" />
        {ministry.name}
      </span>
      <span className="flex-1" />
      <Link
        href={`/ministry-hub/${ministry.id}`}
        className="text-[12px] font-semibold text-[#6B7280] hover:text-[#5CE1A5] flex items-center gap-1 transition-colors"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        <Blocks className="size-3" />
        Open Ministry Hub
      </Link>
      <Link
        href={basePath}
        className="text-[12px] font-semibold text-[#6B7280] hover:text-[#2D333A] flex items-center gap-1 transition-colors"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        <X className="size-3" />
        Clear filter
      </Link>
    </div>
  );
}
