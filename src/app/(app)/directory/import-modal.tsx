"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { importMembers } from "@/app/actions/members";
import type { MemberInput } from "@/app/actions/members";

// ─── CSV column options ─────────────────────────────────
const COLUMN_OPTIONS = [
  { label: "Skip", value: "" },
  { label: "First Name", value: "first_name" },
  { label: "Last Name", value: "last_name" },
  { label: "Email", value: "email" },
  { label: "Phone", value: "phone" },
  { label: "Address Line 1", value: "address_line_1" },
  { label: "Address Line 2", value: "address_line_2" },
  { label: "City", value: "city" },
  { label: "State", value: "state" },
  { label: "Zip", value: "zip" },
  { label: "Gender", value: "gender" },
  { label: "Birthdate", value: "birthdate" },
  { label: "Membership Status", value: "membership_status" },
  { label: "Member Type", value: "member_type" },
  { label: "Notes", value: "notes" },
];

type Step = "upload" | "mapping" | "importing" | "done";

// ─── CSV parser (handles quoted values) ─────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        row.push(current.trim());
        current = "";
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
        if (ch === "\r") i++;
      } else {
        current += ch;
      }
    }
  }

  // Last row
  row.push(current.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);

  return rows;
}

// ─── Auto-detect mapping ────────────────────────────────
function autoDetectMapping(headers: string[]): string[] {
  const map: Record<string, string> = {
    "first name": "first_name",
    "firstname": "first_name",
    "first": "first_name",
    "last name": "last_name",
    "lastname": "last_name",
    "last": "last_name",
    "email": "email",
    "e-mail": "email",
    "phone": "phone",
    "telephone": "phone",
    "mobile": "phone",
    "address": "address_line_1",
    "address line 1": "address_line_1",
    "address1": "address_line_1",
    "address line 2": "address_line_2",
    "address2": "address_line_2",
    "city": "city",
    "state": "state",
    "zip": "zip",
    "zipcode": "zip",
    "zip code": "zip",
    "gender": "gender",
    "birthdate": "birthdate",
    "birthday": "birthdate",
    "date of birth": "birthdate",
    "dob": "birthdate",
    "status": "membership_status",
    "membership status": "membership_status",
    "type": "member_type",
    "member type": "member_type",
    "notes": "notes",
  };

  return headers.map((h) => map[h.toLowerCase().trim()] ?? "");
}

// ─── Component ──────────────────────────────────────────
export function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    error?: string;
  } | null>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) return;
      const [headerRow, ...dataRows] = parsed;
      setHeaders(headerRow);
      setRows(dataRows);
      setMapping(autoDetectMapping(headerRow));
      setStep("mapping");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleImport = async () => {
    setStep("importing");

    const members: MemberInput[] = rows.map((row) => {
      const m: Record<string, string> = {};
      mapping.forEach((field, idx) => {
        if (field && row[idx]) m[field] = row[idx];
      });
      return {
        first_name: m.first_name ?? "",
        last_name: m.last_name ?? "",
        email: m.email || null,
        phone: m.phone || null,
        address_line_1: m.address_line_1 || null,
        address_line_2: m.address_line_2 || null,
        city: m.city || null,
        state: m.state || null,
        zip: m.zip || null,
        gender: m.gender || null,
        birthdate: m.birthdate || null,
        membership_status: m.membership_status || "active",
        member_type: m.member_type || "member",
        notes: m.notes || null,
      };
    });

    const res = await importMembers(members);
    setResult({
      imported: res.imported ?? 0,
      skipped: res.skipped ?? 0,
      error: res.error,
    });
    setStep("done");
    router.refresh();
  };

  const updateMapping = (idx: number, value: string) => {
    setMapping((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const hasMappedNames =
    mapping.includes("first_name") && mapping.includes("last_name");

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
            <h2
              className="text-lg font-semibold text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Import Members
            </h2>
            <button
              onClick={onClose}
              className="size-9 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === "upload" && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl py-16 px-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragging
                    ? "border-[#5CE1A5] bg-[#5CE1A5]/5"
                    : "border-[#E5E7EB] hover:border-[#5CE1A5] hover:bg-[#F9FAFB]"
                }`}
              >
                <Upload className="size-10 text-[#9CA3AF] mb-4" />
                <p
                  className="text-[15px] font-medium text-[#2D333A] mb-1"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Drop your CSV file here
                </p>
                <p
                  className="text-[13px] text-[#6B7280]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  or click to browse
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processFile(file);
                  }}
                />
              </div>
            )}

            {step === "mapping" && (
              <div>
                <p
                  className="text-sm text-[#6B7280] mb-4"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Map your CSV columns to member fields. We detected{" "}
                  <strong>{rows.length}</strong> rows.
                </p>

                {/* Column mapping */}
                <div className="space-y-2 mb-6">
                  {headers.map((header, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[#F9FAFB]"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="size-4 text-[#9CA3AF] shrink-0" />
                        <span
                          className="text-sm text-[#2D333A] truncate"
                          style={{ fontFamily: "var(--font-source-sans)" }}
                        >
                          {header}
                        </span>
                      </div>
                      <span className="text-[#9CA3AF] text-xs shrink-0">
                        &rarr;
                      </span>
                      <select
                        value={mapping[idx] ?? ""}
                        onChange={(e) => updateMapping(idx, e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#2D333A] outline-none focus:border-[#5CE1A5] bg-white min-w-[160px]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {COLUMN_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <p
                  className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Preview (first 5 rows)
                </p>
                <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB]">
                        {headers.map((h, i) => (
                          <th
                            key={i}
                            className="px-3 py-2 text-left text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap"
                            style={{ fontFamily: "var(--font-poppins)" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, ri) => (
                        <tr key={ri} className="border-t border-[#F3F4F6]">
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className="px-3 py-2 text-[#2D333A] whitespace-nowrap"
                              style={{ fontFamily: "var(--font-source-sans)" }}
                            >
                              {cell || "\u2014"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {step === "importing" && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="size-10 text-[#5CE1A5] animate-spin mb-4" />
                <p
                  className="text-[15px] font-medium text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Importing members...
                </p>
                <p
                  className="text-[13px] text-[#6B7280] mt-1"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  Processing {rows.length} rows
                </p>
              </div>
            )}

            {step === "done" && result && (
              <div className="flex flex-col items-center justify-center py-12">
                {result.error ? (
                  <>
                    <AlertCircle className="size-10 text-red-500 mb-4" />
                    <p
                      className="text-[15px] font-medium text-[#2D333A] mb-1"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      Import Failed
                    </p>
                    <p
                      className="text-[13px] text-red-600 text-center max-w-sm"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {result.error}
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-10 text-[#5CE1A5] mb-4" />
                    <p
                      className="text-[15px] font-medium text-[#2D333A] mb-1"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      Import Complete
                    </p>
                    <p
                      className="text-[13px] text-[#6B7280] text-center"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {result.imported} member{result.imported !== 1 ? "s" : ""}{" "}
                      imported
                      {result.skipped > 0 && (
                        <span>
                          , {result.skipped} skipped (duplicate or missing name)
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
            {step === "mapping" && (
              <>
                <button
                  onClick={() => {
                    setStep("upload");
                    setRows([]);
                    setHeaders([]);
                    setMapping([]);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={!hasMappedNames}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5CE1A5] text-white text-sm font-medium hover:bg-[#4FD498] transition-colors shadow-sm disabled:opacity-50"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Import {rows.length} Members
                </button>
              </>
            )}
            {step === "done" && (
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#5CE1A5] text-white text-sm font-medium hover:bg-[#4FD498] transition-colors shadow-sm"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
