"use client";

import Link from "next/link";
import { ArrowRight, Building2, Info } from "lucide-react";
import { motion } from "motion/react";
import type { MinistryOverview, MinistryTileData } from "@/app/actions/ministry-hub";
import { MinistryTile } from "./ministry-tile";

interface MinistryOverviewViewProps {
  overview: MinistryOverview;
}

const SECTION_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]";

// Per the bento spec, the My Ministries section caps at 3 tiles. Anything
// beyond that overflows into "All Ministries" so users can still find them.
const MY_MAX = 3;

export function MinistryOverviewView({ overview }: MinistryOverviewViewProps) {
  const isAdminOrStaff =
    overview.role === "admin" || overview.role === "staff";

  // Bento overflow: extra "my" ministries past 3 fall to All section.
  const myShown = overview.myMinistries.slice(0, MY_MAX);
  const myOverflow = overview.myMinistries.slice(MY_MAX);
  const allShown = [...myOverflow, ...overview.allMinistries];

  // Empty state: no departments at all (admin/staff with empty org)
  if (!overview.hasAnyDepartments) {
    return (
      <div>
        <Header isAdminOrStaff={isAdminOrStaff} />
        <div className="h-px w-full bg-[#E5E7EB] mb-8" />
        <NoDepartmentsState />
      </div>
    );
  }

  const showMySection = myShown.length > 0;
  const showCallout = !showMySection && isAdminOrStaff;

  return (
    <div>
      <Header isAdminOrStaff={isAdminOrStaff} />
      <div className="h-px w-full bg-[#E5E7EB] mb-8" />

      {/* My Ministries (only if user has assignments) */}
      {showMySection && (
        <section className="mb-14">
          <div className="mb-5">
            <span className={SECTION_LABEL_CLASS} style={{ fontFamily: "var(--font-poppins)" }}>
              Your Ministries
            </span>
          </div>
          <MyMinistriesGrid tiles={myShown} />
        </section>
      )}

      {/* All Ministries (always visible when there are any to show) */}
      {allShown.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <span className={SECTION_LABEL_CLASS} style={{ fontFamily: "var(--font-poppins)" }}>
              All Ministries
            </span>
            <FilterChips />
          </div>

          {showCallout && <UnassignedCallout />}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {allShown.map((tile, idx) => (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min((myShown.length + idx) * 0.06, 0.5),
                  ease: [0.23, 1, 0.32, 1],
                }}
              >
                <MinistryTile tile={tile} size="small" />
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────
function Header({ isAdminOrStaff }: { isAdminOrStaff: boolean }) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
      <div>
        <h1
          className="text-2xl text-[#2D333A] leading-tight"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Ministry Hub
        </h1>
        <p
          className="text-[14px] text-[#6B7280] mt-1 max-w-xl"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Where each ministry&apos;s work lives.
        </p>
      </div>
      {isAdminOrStaff && (
        <Link
          href="/directory/staff-management"
          className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5CE1A5] hover:text-[#3DB882] transition-colors shrink-0"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Manage Departments
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </header>
  );
}

// ─── My Ministries Bento Grid ───────────────────────────────
function MyMinistriesGrid({ tiles }: { tiles: MinistryTileData[] }) {
  // 1 → full-width / 2 → 50/50 / 3 → first wide, next two normal
  if (tiles.length === 1) {
    return (
      <div className="grid grid-cols-1 gap-5">
        <Animated index={0}>
          <MinistryTile tile={tiles[0]} size="large" />
        </Animated>
      </div>
    );
  }

  if (tiles.length === 2) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {tiles.map((t, i) => (
          <Animated key={t.id} index={i}>
            <MinistryTile tile={t} size="medium" />
          </Animated>
        ))}
      </div>
    );
  }

  // tiles.length === 3 — bento: wide hero on row 1, two equal on row 2
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="lg:col-span-2">
        <Animated index={0}>
          <MinistryTile tile={tiles[0]} size="large" />
        </Animated>
      </div>
      {tiles.slice(1).map((t, i) => (
        <Animated key={t.id} index={i + 1}>
          <MinistryTile tile={t} size="medium" />
        </Animated>
      ))}
    </div>
  );
}

function Animated({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay: Math.min(index * 0.06, 0.36),
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Filter chips (placeholder — not functional yet) ────────
function FilterChips() {
  const chips = ["All", "Active", "Recently updated"];
  return (
    <div className="flex items-center gap-1.5">
      {chips.map((c, i) => {
        const isFirst = i === 0;
        return (
          <button
            key={c}
            type="button"
            disabled
            className="h-7 px-2.5 rounded-lg text-[12px] font-semibold transition-colors disabled:cursor-not-allowed"
            style={{
              fontFamily: "var(--font-poppins)",
              backgroundColor: isFirst ? "#F3F4F6" : "transparent",
              color: isFirst ? "#2D333A" : "#9CA3AF",
            }}
            aria-disabled
            title="Filters coming soon"
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

// ─── Inline callout for users with no assignments ───────────
function UnassignedCallout() {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl border mb-6"
      style={{
        backgroundColor: "#F0FDF4",
        borderColor: "rgba(92, 225, 165, 0.35)",
      }}
    >
      <Info className="size-4 text-[#5CE1A5] mt-0.5 shrink-0" />
      <p
        className="text-[13px] text-[#2D333A] leading-snug"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        You&apos;re not assigned to any ministries yet. Browse the ones below or assign yourself in{" "}
        <Link
          href="/directory/staff-management"
          className="font-semibold text-[#059669] hover:underline"
        >
          Staff Management →
        </Link>
      </p>
    </div>
  );
}

// ─── No departments at all ──────────────────────────────────
function NoDepartmentsState() {
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div
        className="size-24 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: "rgba(92, 225, 165, 0.12)" }}
      >
        <Building2 className="size-16 text-[#5CE1A5]" strokeWidth={1.4} />
      </div>
      <h2
        className="text-[#2D333A] text-xl mb-2"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        No ministries yet
      </h2>
      <p
        className="text-[14px] text-[#6B7280] max-w-md mb-6"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Create your first ministry to organize your team&apos;s work, communication, and events.
      </p>
      <Link
        href="/directory/staff-management"
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[14px] font-semibold hover:shadow-md transition-all"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Create Department
      </Link>
    </div>
  );
}
