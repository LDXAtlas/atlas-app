"use client";

import { useState } from "react";
import {
  CalendarDays,
  Copy,
  Check,
  Trash2,
  Plus,
  X,
  Globe,
  User,
  Building2,
} from "lucide-react";
import {
  createFeedToken,
  revokeFeedToken,
  type FeedToken,
} from "@/app/actions/calendar-feeds";

// ─── Types ──────────────────────────────────────────────

interface CalendarFeedsClientProps {
  initialTokens: FeedToken[];
  departments: { id: string; name: string }[];
  baseUrl: string;
}

type InstructionTab = "google" | "apple" | "outlook";

// ─── Feed Type Labels ───────────────────────────────────

function feedTypeLabel(feedType: string, departmentName?: string): string {
  switch (feedType) {
    case "personal":
      return "Personal";
    case "department":
      return departmentName ? `Department: ${departmentName}` : "Department";
    case "organization":
    default:
      return "Organization";
  }
}

function feedTypeIcon(feedType: string) {
  switch (feedType) {
    case "personal":
      return <User className="size-4" />;
    case "department":
      return <Building2 className="size-4" />;
    default:
      return <Globe className="size-4" />;
  }
}

// ─── Component ──────────────────────────────────────────

export function CalendarFeedsClient({
  initialTokens,
  departments,
  baseUrl,
}: CalendarFeedsClientProps) {
  const [tokens, setTokens] = useState<FeedToken[]>(initialTokens);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedType, setFeedType] = useState("organization");
  const [departmentId, setDepartmentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InstructionTab>("google");

  const handleCreate = async () => {
    setCreating(true);
    const result = await createFeedToken(
      feedType,
      feedType === "department" ? departmentId : undefined
    );

    if (result.success && result.url) {
      // Re-fetch tokens by creating a temporary token for display
      const newToken: FeedToken = {
        id: crypto.randomUUID(),
        token: result.url.split("/").pop() || "",
        feed_type: feedType,
        department_id: feedType === "department" ? departmentId : null,
        is_active: true,
        created_at: new Date().toISOString(),
        last_accessed_at: null,
        department_name:
          feedType === "department"
            ? departments.find((d) => d.id === departmentId)?.name
            : undefined,
      };
      setTokens((prev) => [newToken, ...prev]);
      setShowCreateModal(false);
      setFeedType("organization");
      setDepartmentId("");
    }
    setCreating(false);
  };

  const handleRevoke = async (tokenId: string) => {
    const result = await revokeFeedToken(tokenId);
    if (result.success) {
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    }
  };

  const handleCopy = async (token: string, id: string) => {
    const url = `${baseUrl}/api/calendar-feed/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const truncateUrl = (token: string) => {
    const url = `${baseUrl}/api/calendar-feed/${token}`;
    if (url.length > 50) {
      return url.substring(0, 47) + "...";
    }
    return url;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="size-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
          >
            <CalendarDays className="size-5 text-[#5CE1A5]" />
          </div>
          <h2
            className="text-2xl text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Calendar Feeds
          </h2>
        </div>
        <p
          className="text-[#6B7280] text-[15px] mt-2 ml-[52px]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Subscribe to your Atlas calendar from Google Calendar, Apple Calendar,
          or Outlook
        </p>
      </div>

      {/* Create Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[14px] font-semibold transition-all hover:opacity-90"
          style={{
            fontFamily: "var(--font-poppins)",
            backgroundColor: "#5CE1A5",
          }}
        >
          <Plus className="size-4" />
          Create New Feed
        </button>
      </div>

      {/* Feed Tokens List */}
      {tokens.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center">
          <CalendarDays className="size-10 text-[#9CA3AF] mx-auto mb-3" />
          <p
            className="text-[#6B7280] text-[15px]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            No calendar feeds yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex items-center gap-4"
            >
              <div
                className="size-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#F4F5F7" }}
              >
                <span className="text-[#5CE1A5]">
                  {feedTypeIcon(token.feed_type)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-[14px] font-semibold text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {feedTypeLabel(token.feed_type, token.department_name)}
                </p>
                <p
                  className="text-[13px] text-[#9CA3AF] truncate mt-0.5"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {truncateUrl(token.token)}
                </p>
                {token.last_accessed_at && (
                  <p
                    className="text-[12px] text-[#9CA3AF] mt-1"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    Last accessed:{" "}
                    {new Date(token.last_accessed_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(token.token, token.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[13px] font-medium transition-all hover:border-[#5CE1A5] hover:text-[#5CE1A5]"
                  style={{
                    fontFamily: "var(--font-poppins)",
                    color: copiedId === token.id ? "#5CE1A5" : "#6B7280",
                  }}
                >
                  {copiedId === token.id ? (
                    <>
                      <Check className="size-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleRevoke(token.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[13px] font-medium text-[#6B7280] hover:border-red-300 hover:text-red-500 transition-all"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  <Trash2 className="size-3.5" />
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions Section */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
        <h3
          className="text-[16px] font-semibold text-[#2D333A] mb-4"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          How to Subscribe
        </h3>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#F4F5F7] rounded-xl p-1 w-fit">
          {(
            [
              { key: "google" as InstructionTab, label: "Google Calendar" },
              { key: "apple" as InstructionTab, label: "Apple Calendar" },
              { key: "outlook" as InstructionTab, label: "Outlook" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
              style={{
                fontFamily: "var(--font-poppins)",
                backgroundColor: activeTab === key ? "#FFFFFF" : "transparent",
                color: activeTab === key ? "#2D333A" : "#6B7280",
                boxShadow:
                  activeTab === key
                    ? "0 1px 3px rgba(0,0,0,0.08)"
                    : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div
          className="text-[14px] text-[#6B7280] space-y-3"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {activeTab === "google" && (
            <ol className="list-decimal list-inside space-y-2">
              <li>Open Google Calendar in your browser</li>
              <li>
                Click the <strong className="text-[#2D333A]">+</strong> next to
                &quot;Other calendars&quot; in the left sidebar
              </li>
              <li>
                Select{" "}
                <strong className="text-[#2D333A]">
                  &quot;From URL&quot;
                </strong>
              </li>
              <li>Paste your feed URL</li>
              <li>
                Click{" "}
                <strong className="text-[#2D333A]">
                  &quot;Add calendar&quot;
                </strong>
              </li>
            </ol>
          )}
          {activeTab === "apple" && (
            <ol className="list-decimal list-inside space-y-2">
              <li>Open Calendar on your Mac</li>
              <li>
                Go to{" "}
                <strong className="text-[#2D333A]">
                  File &rarr; New Calendar Subscription
                </strong>
              </li>
              <li>Paste your feed URL</li>
              <li>
                Click{" "}
                <strong className="text-[#2D333A]">
                  &quot;Subscribe&quot;
                </strong>
              </li>
              <li>
                Set auto-refresh to{" "}
                <strong className="text-[#2D333A]">
                  &quot;Every hour&quot;
                </strong>
              </li>
            </ol>
          )}
          {activeTab === "outlook" && (
            <ol className="list-decimal list-inside space-y-2">
              <li>Open Outlook Calendar</li>
              <li>
                Click{" "}
                <strong className="text-[#2D333A]">
                  &quot;Add calendar&quot; &rarr; &quot;Subscribe from
                  web&quot;
                </strong>
              </li>
              <li>Paste your feed URL</li>
              <li>
                Click{" "}
                <strong className="text-[#2D333A]">
                  &quot;Import&quot;
                </strong>
              </li>
            </ol>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-white rounded-2xl border border-[#E5E7EB] p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3
                className="text-[16px] font-semibold text-[#2D333A]"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Create Calendar Feed
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Feed Type Selector */}
            <div className="mb-4">
              <label
                className="block text-[13px] font-medium text-[#2D333A] mb-1.5"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Feed Type
              </label>
              <select
                value={feedType}
                onChange={(e) => {
                  setFeedType(e.target.value);
                  setDepartmentId("");
                }}
                className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-[14px] text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-colors"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                <option value="personal">Personal</option>
                <option value="organization">Organization</option>
                <option value="department">Department</option>
              </select>
            </div>

            {/* Department Picker */}
            {feedType === "department" && (
              <div className="mb-4">
                <label
                  className="block text-[13px] font-medium text-[#2D333A] mb-1.5"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-[14px] text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-colors"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  <option value="">Select a department...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[14px] font-medium text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  creating ||
                  (feedType === "department" && !departmentId)
                }
                className="flex-1 px-4 py-2.5 rounded-xl text-white text-[14px] font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  fontFamily: "var(--font-poppins)",
                  backgroundColor: "#5CE1A5",
                }}
              >
                {creating ? "Creating..." : "Create Feed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
