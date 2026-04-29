"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Clock, ChevronDown } from "lucide-react";
import { createTask, updateTask } from "@/app/actions/tasks";
import type { Task, TeamMember, Department } from "./tasks-view";

type Priority = "high" | "medium" | "low" | "urgent";

const PRIORITY_OPTIONS: {
  key: Priority;
  label: string;
  dot: string;
  activeText: string;
  activeBg: string;
  activeBorder: string;
}[] = [
  {
    key: "high",
    label: "High",
    dot: "#EF4444",
    activeText: "text-red-500",
    activeBg: "bg-red-50",
    activeBorder: "border-red-200",
  },
  {
    key: "medium",
    label: "Medium",
    dot: "#F59E0B",
    activeText: "text-amber-500",
    activeBg: "bg-amber-50",
    activeBorder: "border-amber-200",
  },
  {
    key: "low",
    label: "Low",
    dot: "#3B82F6",
    activeText: "text-blue-500",
    activeBg: "bg-blue-50",
    activeBorder: "border-blue-200",
  },
  {
    key: "urgent",
    label: "None",
    dot: "#E5E7EB",
    activeText: "text-[#9CA3AF]",
    activeBg: "bg-[#F4F5F7]",
    activeBorder: "border-[#E5E7EB]",
  },
];

export function TaskModal({
  open,
  onClose,
  task,
  teamMembers,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  teamMembers: TeamMember[];
  departments: Department[];
}) {
  const isEditing = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("low");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const titleRef = useRef<HTMLInputElement>(null);

  // Populate form when editing
  useEffect(() => {
    if (open && task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority as Priority);
      if (task.due_date) {
        const d = new Date(task.due_date);
        setDueDate(d.toISOString().split("T")[0]);
        const hours = d.getHours().toString().padStart(2, "0");
        const mins = d.getMinutes().toString().padStart(2, "0");
        if (hours !== "00" || mins !== "00") {
          setDueTime(`${hours}:${mins}`);
        } else {
          setDueTime("");
        }
      } else {
        setDueDate("");
        setDueTime("");
      }
      setAssignedTo(task.assigned_to || "");
      setDepartmentId(task.department_id || "");
    } else if (open && !task) {
      // Reset form for new task
      setTitle("");
      setDescription("");
      setPriority("low");
      setDueDate("");
      setDueTime("");
      setAssignedTo("");
      setDepartmentId("");
    }
    setError(null);
  }, [open, task]);

  // Autofocus title
  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open]);

  function handleSubmit() {
    if (!title.trim()) {
      setError("Please add a title for your task.");
      return;
    }
    setError(null);

    let dueDateISO: string | null = null;
    if (dueDate) {
      if (dueTime) {
        dueDateISO = new Date(`${dueDate}T${dueTime}`).toISOString();
      } else {
        dueDateISO = new Date(`${dueDate}T00:00:00`).toISOString();
      }
    }

    // Map "urgent" priority used as "none" back — since the schema uses 'low' as default
    // We use 'urgent' in the UI as placeholder for "None" priority
    const mappedPriority = priority === "urgent" ? "low" : priority;

    startTransition(async () => {
      const result = isEditing
        ? await updateTask(task!.id, {
            title: title.trim(),
            description: description.trim() || undefined,
            priority: mappedPriority,
            due_date: dueDateISO,
            assigned_to: assignedTo || null,
            department_id: departmentId || null,
          })
        : await createTask({
            title: title.trim(),
            description: description.trim() || undefined,
            priority: mappedPriority,
            due_date: dueDateISO,
            assigned_to: assignedTo || null,
            department_id: departmentId || null,
          });

      if (result.success) {
        onClose();
      } else {
        setError(result.error || "Something went wrong.");
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
            onClick={onClose}
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
                    <h2
                      className="text-[20px] text-[#2D333A]"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 600,
                      }}
                    >
                      {isEditing ? "Edit Task" : "New Task"}
                    </h2>
                    <p
                      className="text-[#6B7280] text-[13px] mt-0.5"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {isEditing
                        ? "Update your task details"
                        : "Add a new task to your list"}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-[#F4F5F7] rounded-lg text-[#6B7280] transition-colors"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Title */}
                <div className="mb-4">
                  <label
                    className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    Task Title
                  </label>
                  <input
                    ref={titleRef}
                    type="text"
                    placeholder="What needs to get done?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) handleSubmit();
                    }}
                    className="w-full bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[15px] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  />
                </div>

                {/* Description */}
                <div className="mb-5">
                  <label
                    className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    placeholder="Add a description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[15px] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all resize-none"
                    style={{
                      fontFamily: "var(--font-source-sans)",
                      fontWeight: 400,
                    }}
                  />
                </div>

                {/* Priority */}
                <div className="mb-5">
                  <label
                    className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    Priority
                  </label>
                  <div className="flex gap-2">
                    {PRIORITY_OPTIONS.map((opt) => {
                      const isActive = priority === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setPriority(opt.key)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[12px] transition-all ${
                            isActive
                              ? `${opt.activeBg} ${opt.activeText} ${opt.activeBorder}`
                              : "border-[#E5E7EB] text-[#9CA3AF] hover:bg-[#F9FAFB]"
                          }`}
                          style={{
                            fontFamily: "var(--font-poppins)",
                            fontWeight: 600,
                          }}
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: isActive
                                ? opt.dot
                                : "#D1D5DB",
                            }}
                          />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Due date + time row */}
                <div className="flex gap-3 mb-5">
                  <div className="flex-1">
                    <label
                      className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 600,
                      }}
                    >
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[14px] text-[#2D333A] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 600,
                      }}
                    >
                      Due Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF] pointer-events-none" />
                      <input
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                        className="w-full pl-10 pr-4 bg-[#F4F5F7] border border-transparent rounded-xl py-3 text-[14px] text-[#2D333A] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Assign to */}
                <div className="mb-5">
                  <label
                    className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    Assign To
                  </label>
                  <div className="relative">
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full appearance-none bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[14px] text-[#2D333A] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all pr-10"
                      style={{
                        fontFamily: "var(--font-source-sans)",
                        fontWeight: 500,
                      }}
                    >
                      <option value="">Myself</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </div>

                {/* Department */}
                <div className="mb-5">
                  <label
                    className="text-[11px] uppercase tracking-widest text-[#9CA3AF] block mb-2"
                    style={{
                      fontFamily: "var(--font-poppins)",
                      fontWeight: 600,
                    }}
                  >
                    Department
                  </label>
                  <div className="relative">
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full appearance-none bg-[#F4F5F7] border border-transparent rounded-xl px-4 py-3 text-[14px] text-[#2D333A] focus:ring-2 focus:ring-[#5CE1A5]/10 focus:border-[#5CE1A5]/40 outline-none transition-all pr-10"
                      style={{
                        fontFamily: "var(--font-source-sans)",
                        fontWeight: 500,
                      }}
                    >
                      <option value="">No department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF] pointer-events-none" />
                  </div>
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
                    onClick={onClose}
                    className="flex-1 px-5 py-3 text-[#6B7280] rounded-xl text-[14px] hover:bg-[#F4F5F7] transition-all border border-[#E5E7EB]"
                    style={{ fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="flex-1 px-5 py-3 bg-[#5CE1A5] text-white rounded-xl text-[14px] shadow-lg shadow-[#5CE1A5]/20 hover:bg-[#4CD99A] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontWeight: 600 }}
                  >
                    {isPending
                      ? isEditing
                        ? "Saving..."
                        : "Creating..."
                      : isEditing
                        ? "Save Changes"
                        : "Create Task"}
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
