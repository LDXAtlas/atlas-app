"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Send,
  Globe,
  ShieldCheck,
  Users,
  ChevronDown,
  Building,
} from "lucide-react";
import Link from "next/link";
import { createAnnouncement, updateAnnouncement } from "@/app/actions/announcements";
import type { Announcement } from "./announcements-view";

type Category = "general" | "staff" | "ministry";

const CHANNELS: {
  id: Category;
  label: string;
  icon: typeof Globe;
  color: string;
  description: string;
}[] = [
  { id: "general", label: "General", icon: Globe, color: "#5CE1A5", description: "All church members" },
  { id: "staff", label: "Staff", icon: ShieldCheck, color: "#3B82F6", description: "Admins & staff only" },
  { id: "ministry", label: "Ministry", icon: Users, color: "#8B5CF6", description: "Ministry teams" },
];

interface Department {
  id: string;
  name: string;
  color: string;
}

export function ComposeModal({
  open,
  onClose,
  departments = [],
  editAnnouncement,
}: {
  open: boolean;
  onClose: () => void;
  departments?: Department[];
  editAnnouncement?: Announcement | null;
}) {
  const isEditing = !!editAnnouncement;
  const [title, setTitle] = useState(editAnnouncement?.title || "");
  const [content, setContent] = useState(editAnnouncement?.content || "");
  const [category, setCategory] = useState<Category>((editAnnouncement?.category as Category) || "general");
  const [audience, setAudience] = useState<"everyone" | "department">(editAnnouncement?.target_department_id ? "department" : "everyone");
  const [selectedDeptId, setSelectedDeptId] = useState<string>(editAnnouncement?.target_department_id || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Re-initialize form when editAnnouncement changes
  useState(() => {
    if (editAnnouncement) {
      setTitle(editAnnouncement.title);
      setContent(editAnnouncement.content);
      setCategory((editAnnouncement.category as Category) || "general");
      setAudience(editAnnouncement.target_department_id ? "department" : "everyone");
      setSelectedDeptId(editAnnouncement.target_department_id || "");
    }
  });

  function resetForm() {
    setTitle("");
    setContent("");
    setCategory("general");
    setAudience("everyone");
    setSelectedDeptId("");
    setError(null);
  }

  function handlePost() {
    if (!title.trim()) {
      setError("Please add a title for your update.");
      return;
    }
    if (!content.trim()) {
      setError("Please add a message for your update.");
      return;
    }
    if (audience === "department" && !selectedDeptId) {
      setError("Please select a department.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        category,
        target_department_id: audience === "department" ? selectedDeptId : null,
      };

      const result = isEditing
        ? await updateAnnouncement(editAnnouncement!.id, payload)
        : await createAnnouncement(payload);

      if (result.success) {
        resetForm();
        onClose();
      } else {
        setError(result.error || `Failed to ${isEditing ? "update" : "post"} announcement.`);
      }
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { resetForm(); onClose(); }}
            className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-[95] flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-auto w-full max-w-[560px] bg-white rounded-[20px] shadow-2xl overflow-hidden border border-[#E5E7EB]/50 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-[20px] text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>
                      {isEditing ? "Edit Update" : "Create Update"}
                    </h2>
                    <p className="text-[#6B7280] text-[13px] mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>
                      Broadcast to your church community
                    </p>
                  </div>
                  <button onClick={() => { resetForm(); onClose(); }} className="p-2 hover:bg-[#F4F5F7] rounded-lg text-[#6B7280] transition-colors">
                    <X className="size-5" />
                  </button>
                </div>

                {/* Channel Selection */}
                <div className="mb-5">
                  <label className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>
                    Channel
                  </label>
                  <div className="flex gap-2">
                    {CHANNELS.map((ch) => {
                      const Icon = ch.icon;
                      const isActive = category === ch.id;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => setCategory(ch.id)}
                          className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] transition-all border ${
                            isActive ? "border-current shadow-sm" : "border-[#E5E7EB] bg-[#F4F5F7] text-[#6B7280] hover:border-[#9CA3AF]"
                          }`}
                          style={isActive ? { fontWeight: 600, color: ch.color, backgroundColor: `${ch.color}08`, borderColor: `${ch.color}40` } : { fontWeight: 600 }}
                        >
                          <Icon className="size-4" />
                          <div className="text-left">
                            <div>{ch.label}</div>
                            <div className="text-[9px] opacity-60" style={{ fontWeight: 500 }}>{ch.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Audience Targeting */}
                <div className="mb-5">
                  <label className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>
                    Audience
                  </label>
                  <div className="relative">
                    <select
                      value={audience}
                      onChange={(e) => {
                        setAudience(e.target.value as "everyone" | "department");
                        if (e.target.value === "everyone") setSelectedDeptId("");
                      }}
                      className="w-full appearance-none bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[14px] text-[#2D333A] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all pr-10"
                      style={{ fontFamily: "var(--font-source-sans)", fontWeight: 500 }}
                    >
                      <option value="everyone">Everyone</option>
                      <option value="department">Specific Department</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF] pointer-events-none" />
                  </div>

                  {/* Department selector */}
                  {audience === "department" && (
                    <div className="mt-3">
                      {departments.length > 0 ? (
                        <div className="relative">
                          <select
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="w-full appearance-none bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[14px] text-[#2D333A] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all pr-10"
                            style={{ fontFamily: "var(--font-source-sans)", fontWeight: 500 }}
                          >
                            <option value="">Select a department...</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF] pointer-events-none" />
                        </div>
                      ) : (
                        <div className="p-3 bg-[#F4F5F7] rounded-xl border border-[#E5E7EB]">
                          <div className="flex items-center gap-2 mb-1">
                            <Building className="size-4 text-[#9CA3AF]" />
                            <span className="text-[13px] text-[#6B7280]" style={{ fontFamily: "var(--font-source-sans)" }}>
                              No departments yet.
                            </span>
                          </div>
                          <Link
                            href="/directory/staff-management"
                            className="text-[12px] text-[#5CE1A5] hover:underline"
                            style={{ fontFamily: "var(--font-source-sans)", fontWeight: 600 }}
                          >
                            Create one in Directory → Staff Management
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Title */}
                <div className="mb-4">
                  <label className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>
                    Headline
                  </label>
                  <input
                    type="text"
                    placeholder="Give your update a clear, bold title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[15px] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all"
                    style={{ fontWeight: 600 }}
                  />
                </div>

                {/* Body */}
                <div className="mb-5">
                  <label className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2" style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}>
                    Message
                  </label>
                  <textarea
                    placeholder="What's happening? Share an update with your community..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    className="w-full bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[15px] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all resize-none"
                    style={{ fontFamily: "var(--font-source-sans)", fontWeight: 400 }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { resetForm(); onClose(); }}
                    className="flex-1 px-5 py-3 text-[#6B7280] rounded-xl text-[14px] hover:bg-[#F4F5F7] transition-all border border-[#E5E7EB]"
                    style={{ fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePost}
                    disabled={isPending}
                    className="flex-1 px-5 py-3 bg-[#5CE1A5] text-white rounded-xl text-[14px] shadow-lg shadow-[#5CE1A5]/20 hover:bg-[#4CD99A] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontWeight: 600 }}
                  >
                    <Send className="size-4" />
                    {isPending ? (isEditing ? "Saving..." : "Posting...") : (isEditing ? "Save Changes" : "Post Update")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
