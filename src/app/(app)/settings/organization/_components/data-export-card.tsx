"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, AlertCircle, Check, FileJson } from "lucide-react";
import { exportOrganizationData } from "@/app/actions/data-export";

interface DataExportCardProps {
  /** Server-side admin gate is enforced inside exportOrganizationData; we also
   *  hide the control for non-admins so they don't see a button that will 403. */
  isAdmin: boolean;
}

// What's in the file, stated plainly so an admin knows what they're
// downloading before they click. Called out explicitly: member records include
// free-text pastoral notes.
const CONTENTS = [
  "Organization details, staff profiles, ministry areas / departments",
  "Congregation member directory — including free-text pastoral notes",
  "Announcements, tasks (with comments), calendar events",
  "Project boards: lists, cards, checklists, comments, labels, activity",
  "Huddles: agenda, notes, decisions, action items, attendees",
  "Library file details (names, folders, tags, uploaders, dates) — not the files themselves",
];

export function DataExportCard({ isAdmin }: DataExportCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; warnings: string[] } | null>(null);

  function handleExport() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await exportOrganizationData();
      if (!res.success) {
        setError(res.error);
        return;
      }
      const { filename, json, summary } = res.data!;
      // Trigger the browser download from the returned JSON string.
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setResult({ count: summary.totalRecords, warnings: summary.warnings });
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 rounded-xl bg-[#5CE1A5]/15 flex items-center justify-center shrink-0">
          <FileJson className="size-5 text-[#3DB882]" />
        </div>
        <div>
          <h3
            className="text-[16px] text-[#2D333A] leading-tight"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Data Export
          </h3>
          <p
            className="text-[13px] text-[#6B7280] mt-0.5"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Download everything your organization has in Atlas as a single JSON file.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-[#FAFAFA] border border-[#F0F0F0] p-4 mb-4">
        <p
          className="text-[12px] uppercase tracking-wide text-[#9CA3AF] mb-2"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          The file includes
        </p>
        <ul className="space-y-1.5">
          {CONTENTS.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-[13px] text-[#4B5563]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              <Check className="size-3.5 text-[#5CE1A5] mt-0.5 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p
          className="text-[12px] text-[#9CA3AF] mt-3 pt-3 border-t border-[#F0F0F0]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Excludes billing identifiers, access tokens, and Atlas internal
          settings. Only admins can export.
        </p>
      </div>

      {!isAdmin ? (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#F4F5F7] border border-[#E5E7EB] text-[13px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>Only an organization admin can export data. Contact an admin if you need a copy.</span>
        </div>
      ) : (
        <>
          <button
            onClick={handleExport}
            disabled={pending}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5CE1A5] text-[#0F3D2E] hover:bg-[#4FD199] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, fontSize: "14px" }}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Preparing export…
              </>
            ) : (
              <>
                <Download className="size-4" />
                Export organization data
              </>
            )}
          </button>

          {error && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 mt-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-[#DC2626]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="mt-3 space-y-2">
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#5CE1A5]/10 border border-[#5CE1A5]/30 text-[13px] text-[#0F3D2E]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <Check className="size-4 shrink-0 mt-0.5" />
                <span>
                  Export downloaded — {result.count.toLocaleString()} record
                  {result.count === 1 ? "" : "s"} across your organization.
                </span>
              </div>
              {result.warnings.length > 0 && (
                <div
                  className="px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-100 text-[12px] text-[#92400E]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span style={{ fontWeight: 600 }}>
                      {result.warnings.length} note{result.warnings.length === 1 ? "" : "s"} about this export
                    </span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
