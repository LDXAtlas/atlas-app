"use client";

import { Folder, Library, Search, Upload } from "lucide-react";

interface CenteredStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}

function CenteredState({ icon, title, body, action }: CenteredStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16">
      <div
        className="size-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: "rgba(92, 225, 165, 0.10)" }}
      >
        {icon}
      </div>
      <h2
        className="text-xl text-[#0F172A] mb-1.5"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
      >
        {title}
      </h2>
      <p
        className="text-[14px] text-[#6B7280] max-w-md mb-4"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        {body}
      </p>
      {action}
    </div>
  );
}

export function LibraryEmptyState({
  onUpload,
  canUpload,
}: {
  onUpload: () => void;
  canUpload: boolean;
}) {
  return (
    <CenteredState
      icon={<Library className="size-7 text-[#5CE1A5]" />}
      title="Your Library is empty"
      body="Upload files to share with your team, or attach them to tasks, announcements, and events — they'll all show up here."
      action={
        canUpload ? (
          <button
            type="button"
            onClick={onUpload}
            className="h-9 px-4 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-[#4DD395] transition-colors"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Upload className="size-3.5" />
            Upload files
          </button>
        ) : null
      }
    />
  );
}

export function EmptyFolderState({
  onUpload,
  canUpload,
}: {
  onUpload: () => void;
  canUpload: boolean;
}) {
  return (
    <CenteredState
      icon={<Folder className="size-7 text-[#5CE1A5]" />}
      title="This folder is empty"
      body="Drop files here or use the upload button to populate it."
      action={
        canUpload ? (
          <button
            type="button"
            onClick={onUpload}
            className="text-[13px] text-[#5CE1A5] hover:text-[#059669] font-semibold inline-flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <Upload className="size-3.5" />
            Upload files
          </button>
        ) : null
      }
    />
  );
}

export function NoSearchResultsState({
  onReset,
}: {
  onReset: () => void;
}) {
  return (
    <CenteredState
      icon={<Search className="size-7 text-[#5CE1A5]" />}
      title="No files match your search"
      body="Try a different keyword or clear the filters."
      action={
        <button
          type="button"
          onClick={onReset}
          className="text-[13px] text-[#5CE1A5] hover:text-[#059669] font-semibold"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          Clear filters
        </button>
      }
    />
  );
}

export function StorageBanner({
  used,
  limit,
  pct,
}: {
  used: string;
  limit: string;
  pct: number;
}) {
  if (pct < 80) return null;
  const over = pct >= 100;
  return (
    <div
      className={`px-5 py-2.5 border-b ${
        over
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}
      style={{ fontFamily: "var(--font-source-sans)" }}
    >
      <p className="text-[13px]">
        {over ? (
          <>
            <strong>Storage limit reached.</strong> You&rsquo;ve used {used} of{" "}
            {limit}. Delete files or contact your admin about upgrading.
          </>
        ) : (
          <>
            You&rsquo;ve used <strong>{Math.round(pct)}%</strong> of your storage
            ({used} of {limit}). Consider clearing old files.
          </>
        )}
      </p>
    </div>
  );
}
