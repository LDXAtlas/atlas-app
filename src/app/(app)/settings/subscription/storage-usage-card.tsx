"use client";

import { useEffect, useState } from "react";
import { HardDrive, FileText, AlertCircle } from "lucide-react";
import {
  getOrganizationStorageUsage,
  getStorageBreakdown,
  type StorageUsage,
  type StorageBreakdownItem,
} from "@/app/actions/attachments";

export function StorageUsageCard() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [u, b] = await Promise.all([
        getOrganizationStorageUsage(),
        getStorageBreakdown(),
      ]);
      if (cancelled) return;
      if (!u.success) {
        setError(u.error);
      } else if (u.data) {
        setUsage(u.data);
      }
      if (b.success && b.data) setBreakdown(b.data);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const pct = usage?.percentage_used ?? 0;
  const nearLimit = pct >= 80 && pct < 100;
  const overLimit = pct >= 100;
  const barColor = overLimit
    ? "#EF4444"
    : nearLimit
      ? "#F59E0B"
      : "#5CE1A5";

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="size-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#5CE1A512" }}
        >
          <HardDrive className="size-5 text-[#5CE1A5]" />
        </div>
        <div>
          <h3
            className="text-[16px] font-semibold text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            File Storage
          </h3>
          <p
            className="text-[13px] text-[#6B7280] mt-0.5"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Files attached to tasks, announcements, events, and boards.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 text-[13px] text-[#EF4444] bg-[#FEF2F2] rounded-xl px-3 py-2 mb-4"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {!error && (
        <>
          {/* Usage bar */}
          <div className="mb-5">
            <div
              className="flex items-baseline justify-between mb-2"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              <p className="text-[18px] font-semibold text-[#2D333A] tabular-nums">
                {loading
                  ? "—"
                  : usage
                    ? `${usage.formatted.used} / ${usage.formatted.limit}`
                    : "—"}
              </p>
              <p
                className="text-[13px] tabular-nums"
                style={{ color: barColor, fontWeight: 600 }}
              >
                {loading || !usage ? "" : `${Math.round(pct)}%`}
              </p>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            {nearLimit && (
              <p
                className="text-[12px] text-[#B45309] mt-2"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                You&rsquo;re approaching your storage limit. Consider clearing
                old files or upgrading.
              </p>
            )}
            {overLimit && (
              <p
                className="text-[12px] text-[#B91C1C] mt-2"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                Storage limit reached. New uploads are blocked until you free
                up space or upgrade.
              </p>
            )}
          </div>

          {/* Breakdown */}
          <div>
            <h4
              className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              By feature
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {breakdown
                .filter((b) => b.count > 0)
                .map((b) => (
                  <li
                    key={b.entity_type}
                    className="flex items-center justify-between bg-[#F4F5F7] rounded-xl px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 text-[13px] text-[#2D333A]">
                      <FileText className="size-3.5 text-[#6B7280]" />
                      <span style={{ fontFamily: "var(--font-source-sans)" }}>
                        {b.label}
                      </span>
                      <span className="text-[11px] text-[#9CA3AF] tabular-nums">
                        ({b.count})
                      </span>
                    </div>
                    <span
                      className="text-[12px] text-[#6B7280] tabular-nums"
                      style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                    >
                      {b.formatted}
                    </span>
                  </li>
                ))}
              {!loading && breakdown.every((b) => b.count === 0) && (
                <li
                  className="text-[13px] text-[#9CA3AF] col-span-full py-2"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  No files yet.
                </li>
              )}
            </ul>
          </div>

          {/* Notes / Phase-2 teaser */}
          <div className="mt-5 pt-4 border-t border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[12px] text-[#6B7280]">
            <p style={{ fontFamily: "var(--font-source-sans)" }}>
              Max single file: <span className="tabular-nums">25 MB</span>
            </p>
            <p
              className="sm:ml-auto text-[#9CA3AF]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Need more space? Storage Packs coming soon.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
