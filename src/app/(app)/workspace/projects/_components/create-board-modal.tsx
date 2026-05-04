"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, Loader2, Check, AlertCircle, Globe, Building, Lock, EyeOff } from "lucide-react";
import {
  createBoard,
  type BoardTemplateId,
  type BoardVisibility,
} from "@/app/actions/boards";
import { getIconByName, MINISTRY_ICON_NAMES } from "@/lib/icons";

const BOARD_TEMPLATE_OPTIONS: {
  id: BoardTemplateId;
  label: string;
  description: string;
}[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Start with an empty board and add columns as you go.",
  },
  {
    id: "basic",
    label: "Basic Workflow",
    description: "To Do · In Progress · Done",
  },
  {
    id: "sermon_series",
    label: "Sermon Series",
    description: "Idea · Outlined · Drafted · Reviewed · Final",
  },
  {
    id: "event_planning",
    label: "Event Planning",
    description: "Backlog · Planning · Promotion · Live · Wrap-up",
  },
  {
    id: "capital_campaign",
    label: "Capital Campaign",
    description: "Research · Proposal · Active · Complete",
  },
];

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#FBBF24", "#EAB308", "#84CC16",
  "#5CE1A5", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9", "#3B82F6",
  "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E",
  "#64748B", "#6B7280", "#71717A", "#78716C", "#292524", "#18181B",
];

interface CreateBoardModalProps {
  open: boolean;
  onClose: () => void;
  departments: { id: string; name: string; color: string }[];
  viewerId: string | null;
}

const VISIBILITY_OPTIONS: {
  id: BoardVisibility;
  label: string;
  description: string;
  Icon: typeof Globe;
}[] = [
  {
    id: "organization",
    label: "Organization",
    description: "Everyone in your church can see this board.",
    Icon: Globe,
  },
  {
    id: "department",
    label: "Department",
    description: "Only members of the selected department can see it.",
    Icon: Building,
  },
  {
    id: "private",
    label: "Private",
    description: "Only you and people you invite can see it.",
    Icon: Lock,
  },
  {
    id: "invitees_only",
    label: "Invitees Only",
    description: "Only specific people you add as members.",
    Icon: EyeOff,
  },
];

export function CreateBoardModal({
  open,
  onClose,
  departments,
}: CreateBoardModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#5CE1A5");
  const [icon, setIcon] = useState("Folder");
  const [iconSearch, setIconSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [visibility, setVisibility] =
    useState<BoardVisibility>("organization");
  const [template, setTemplate] = useState<BoardTemplateId>("blank");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset state whenever the modal closes / reopens.
  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setColor("#5CE1A5");
    setIcon("Folder");
    setIconSearch("");
    setDepartmentId("");
    setVisibility("organization");
    setTemplate("blank");
    setError(null);
  }, [open]);

  // Auto-set department visibility once a department is picked, so users
  // don't have to manually flip both switches.
  useEffect(() => {
    if (departmentId && visibility === "organization") {
      setVisibility("department");
    }
  }, [departmentId, visibility]);

  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return MINISTRY_ICON_NAMES;
    const q = iconSearch.toLowerCase();
    return MINISTRY_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [iconSearch]);

  const PreviewIcon = getIconByName(icon);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Give your board a name to get started.");
      return;
    }
    if (visibility === "department" && !departmentId) {
      setError("Pick a department for department-visibility boards.");
      return;
    }
    startTransition(async () => {
      const result = await createBoard({
        name: name.trim(),
        description: description.trim() || null,
        color,
        icon,
        department_id: departmentId || null,
        visibility,
        template,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onClose();
      // Phase 2 will land /workspace/projects/[id]; for now refresh the list
      // so the new board appears immediately.
      router.refresh();
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
          onClick={() => !isPending && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="size-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: color }}
                >
                  <PreviewIcon className="size-5" />
                </div>
                <div>
                  <h2
                    className="text-[16px] text-[#2D333A] leading-tight"
                    style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
                  >
                    {name.trim() || "New project board"}
                  </h2>
                  <p
                    className="text-[12px] text-[#6B7280]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    Set up the board, then invite the team.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100">
                  <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                  <p
                    className="text-[13px] text-red-600"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {error}
                  </p>
                </div>
              )}

              {/* Title */}
              <Field label="Board name *">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What's this project called?"
                  autoFocus
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </Field>

              {/* Description */}
              <Field label="Description" optional>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What is this board for?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors resize-none"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </Field>

              {/* Color + icon side by side */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Color">
                  <div className="grid grid-cols-6 gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="size-7 rounded-lg flex items-center justify-center transition-transform hover:scale-105"
                        style={{
                          backgroundColor: c,
                          boxShadow:
                            color === c
                              ? `0 0 0 2px white, 0 0 0 4px ${c}`
                              : undefined,
                        }}
                        aria-label={`Choose ${c}`}
                      >
                        {color === c && (
                          <Check className="size-3.5 text-white drop-shadow-sm" />
                        )}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Icon">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF]" />
                    <input
                      type="text"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      placeholder="Search icons..."
                      className="w-full h-7 pl-7 pr-2 rounded-lg border border-[#E5E7EB] bg-[#F4F5F7] text-[12px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    />
                  </div>
                  <div className="grid grid-cols-6 gap-1 max-h-[88px] overflow-y-auto p-0.5">
                    {filteredIcons.map((iconName) => {
                      const Ico = getIconByName(iconName);
                      const isSelected = icon === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setIcon(iconName)}
                          className="size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[#F4F5F7]"
                          style={{
                            backgroundColor: isSelected
                              ? "rgba(92, 225, 165, 0.15)"
                              : undefined,
                            color: isSelected ? "#059669" : "#6B7280",
                          }}
                          title={iconName}
                          aria-label={iconName}
                        >
                          <Ico className="size-3.5" />
                        </button>
                      );
                    })}
                    {filteredIcons.length === 0 && (
                      <p
                        className="col-span-6 text-center text-[11px] text-[#9CA3AF] py-2"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        No icons found
                      </p>
                    )}
                  </div>
                </Field>
              </div>

              {/* Department + visibility */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Department" optional>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-colors"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Visibility">
                  <select
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as BoardVisibility)
                    }
                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[13px] text-[#2D333A] outline-none focus:border-[#5CE1A5] transition-colors"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {VISIBILITY_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p
                className="text-[12px] text-[#9CA3AF] -mt-2"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {VISIBILITY_OPTIONS.find((o) => o.id === visibility)?.description}
              </p>

              {/* Template */}
              <Field label="Start with a template">
                <div className="grid grid-cols-1 gap-2">
                  {BOARD_TEMPLATE_OPTIONS.map((t) => {
                    const selected = template === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplate(t.id)}
                        className="text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors"
                        style={{
                          borderColor: selected ? "#5CE1A5" : "#E5E7EB",
                          backgroundColor: selected
                            ? "rgba(92, 225, 165, 0.06)"
                            : "white",
                        }}
                      >
                        <div
                          className="size-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                          style={{
                            borderColor: selected ? "#5CE1A5" : "#D1D5DB",
                            backgroundColor: selected ? "#5CE1A5" : "transparent",
                          }}
                        >
                          {selected && (
                            <Check className="size-2.5 text-white" strokeWidth={3} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[13px] text-[#2D333A] leading-tight"
                            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                          >
                            {t.label}
                          </p>
                          <p
                            className="text-[12px] text-[#6B7280] mt-0.5"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            {t.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3 shrink-0 bg-white">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="h-10 px-4 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#5CE1A5] text-[#060C09] text-[13px] font-semibold hover:shadow-md transition-all disabled:opacity-50"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                {isPending ? "Creating..." : "Create Board"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="flex items-baseline justify-between mb-1.5 text-[12px] uppercase tracking-[0.06em] text-[#6B7280]"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}
        {optional && (
          <span
            className="text-[10px] text-[#9CA3AF] normal-case tracking-normal"
            style={{ fontFamily: "var(--font-source-sans)", fontWeight: 400 }}
          >
            optional
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
