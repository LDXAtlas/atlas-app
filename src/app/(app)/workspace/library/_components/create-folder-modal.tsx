"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X } from "lucide-react";
import { getIconByName, MINISTRY_ICON_NAMES } from "@/lib/icons";
import {
  createLibraryFolder,
  updateLibraryFolder,
  type LibraryFolder,
  type LibraryFolderVisibility,
} from "@/app/actions/attachments";

// Curated subset that fits "library / shared content" intent. Falls back to
// MINISTRY_ICON_NAMES so the user can pick anything that already exists.
const SUGGESTED_ICONS = [
  "Folder",
  "FolderOpen",
  "Library",
  "BookOpen",
  "FileText",
  "ClipboardList",
  "BookMarked",
  "GraduationCap",
  "School",
  "Music",
  "Mic",
  "Camera",
  "Video",
  "Briefcase",
  "Heart",
  "Sparkles",
  "Star",
  "Lightbulb",
];

// Folder color palette — matches department colors so themes feel
// consistent across the app.
const FOLDER_COLORS = [
  "#6B7280",
  "#5CE1A5",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#10B981",
  "#06B6D4",
  "#14B8A6",
  "#A855F7",
];

interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, edit this folder instead of creating a new one. */
  editing?: LibraryFolder | null;
  parentFolderId?: string | null;
  departments: { id: string; name: string; color: string }[];
  onSaved: (folder: LibraryFolder) => void;
}

export function CreateFolderModal({
  open,
  onClose,
  editing,
  parentFolderId,
  departments,
  onSaved,
}: CreateFolderModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[1]);
  const [icon, setIcon] = useState("Folder");
  const [visibility, setVisibility] = useState<LibraryFolderVisibility>(
    "organization",
  );
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setColor(editing.color);
      setIcon(editing.icon);
      setVisibility(editing.visibility);
      setDepartmentId(editing.department_id);
    } else {
      setName("");
      setDescription("");
      setColor(FOLDER_COLORS[1]);
      setIcon("Folder");
      setVisibility("organization");
      setDepartmentId(null);
    }
    setError(null);
  }, [open, editing]);

  function handleSubmit() {
    if (!name.trim()) {
      setError("Folder name is required.");
      return;
    }
    if (visibility === "department" && !departmentId) {
      setError("Pick a department for a department-scoped folder.");
      return;
    }
    startTransition(async () => {
      const res = editing
        ? await updateLibraryFolder(editing.id, {
            name: name.trim(),
            description,
            color,
            icon,
            visibility,
            departmentId,
          })
        : await createLibraryFolder({
            name: name.trim(),
            description,
            color,
            icon,
            visibility,
            departmentId,
            parentFolderId: parentFolderId ?? null,
          });
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.data) onSaved(res.data);
      onClose();
    });
  }

  const PreviewIcon = getIconByName(icon);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="size-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  <PreviewIcon className="size-4" />
                </span>
                <h2
                  className="text-[16px] font-semibold text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {editing ? "Edit folder" : "New folder"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <p
                  className="text-[13px] text-red-600 bg-red-50 rounded-lg px-3 py-2"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {error}
                </p>
              )}

              <Field label="Name">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sermon series"
                  className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[14px] outline-none focus:border-[#5CE1A5]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </Field>

              <Field label="Description (optional)">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What goes in this folder?"
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5] resize-none"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                />
              </Field>

              <Field label="Color">
                <div className="flex flex-wrap gap-1.5">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="size-7 rounded-md transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        boxShadow:
                          color === c
                            ? "0 0 0 2px white, 0 0 0 4px #5CE1A5"
                            : undefined,
                      }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </Field>

              <Field label="Icon">
                <div className="grid grid-cols-9 gap-1.5">
                  {SUGGESTED_ICONS.concat(
                    MINISTRY_ICON_NAMES.filter(
                      (n) => !SUGGESTED_ICONS.includes(n),
                    ).slice(0, 9),
                  ).map((n) => {
                    const I = getIconByName(n);
                    const selected = icon === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setIcon(n)}
                        className={`size-8 rounded-md flex items-center justify-center transition-colors ${
                          selected
                            ? "bg-[#5CE1A5]/15"
                            : "hover:bg-[#F4F5F7]"
                        }`}
                        title={n}
                      >
                        <I
                          className="size-4"
                          style={{ color: selected ? color : "#6B7280" }}
                        />
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Visibility">
                <div className="space-y-1.5">
                  {(
                    [
                      {
                        value: "organization",
                        label: "Organization",
                        hint: "Everyone in your church can see it.",
                      },
                      {
                        value: "department",
                        label: "Department",
                        hint: "Only members of a specific department.",
                      },
                      {
                        value: "private",
                        label: "Private",
                        hint: "Only you.",
                      },
                    ] as const
                  ).map((opt) => {
                    const selected = visibility === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                          selected
                            ? "border-[#5CE1A5] bg-[#5CE1A5]/5"
                            : "border-[#E5E7EB] hover:bg-[#F4F5F7]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="folder-visibility"
                          checked={selected}
                          onChange={() => setVisibility(opt.value)}
                          className="mt-1 text-[#5CE1A5] focus:ring-[#5CE1A5]"
                        />
                        <div>
                          <p
                            className="text-[13px] text-[#2D333A]"
                            style={{
                              fontFamily: "var(--font-poppins)",
                              fontWeight: 600,
                            }}
                          >
                            {opt.label}
                          </p>
                          <p
                            className="text-[11.5px] text-[#6B7280]"
                            style={{ fontFamily: "var(--font-source-sans)" }}
                          >
                            {opt.hint}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </Field>

              {visibility === "department" && (
                <Field label="Department">
                  <select
                    value={departmentId ?? ""}
                    onChange={(e) =>
                      setDepartmentId(e.target.value || null)
                    }
                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[13px] outline-none focus:border-[#5CE1A5]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    <option value="">Select a department…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <footer className="px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2 bg-[#F8FAFC]">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-xl text-[13px] text-[#6B7280] hover:bg-[#F4F5F7]"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !name.trim()}
                className="h-9 px-4 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold hover:bg-[#4DD395] disabled:opacity-50 inline-flex items-center gap-2"
                style={{ fontFamily: "var(--font-poppins)" }}
              >
                <Check className="size-3.5" />
                {pending ? "Saving…" : editing ? "Save" : "Create"}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[11px] uppercase tracking-wider text-[#9CA3AF] block mb-1.5"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

