"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Loader2, RotateCcw, Info } from "lucide-react";
import {
  resetNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferenceWithDefaults,
} from "@/app/actions/notifications";
import type { NotificationType } from "@/lib/notifications-config";

interface CategoryItem {
  type: NotificationType;
  label: string;
  description: string;
}

interface Category {
  category: string;
  description: string;
  items: CategoryItem[];
}

interface NotificationPreferencesProps {
  categories: Category[];
  initialPrefs: NotificationPreferenceWithDefaults[];
}

type Channel = "in_app" | "email";

export function NotificationPreferences({
  categories,
  initialPrefs,
}: NotificationPreferencesProps) {
  // Keyed by NotificationType for fast lookups. The page passes every type
  // we know about (merged with defaults), so any toggle has a starting
  // value even if the user has no row in notification_preferences yet.
  const [prefs, setPrefs] = useState<
    Record<string, NotificationPreferenceWithDefaults>
  >(() => {
    const map: Record<string, NotificationPreferenceWithDefaults> = {};
    initialPrefs.forEach((p) => (map[p.type] = p));
    return map;
  });

  const [savingType, setSavingType] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  async function toggle(type: NotificationType, channel: Channel) {
    const current = prefs[type];
    if (!current) return;
    const nextValue = !current[channel];

    // Optimistic update.
    const optimistic: NotificationPreferenceWithDefaults = {
      ...current,
      [channel]: nextValue,
      is_default: false,
    };
    setPrefs((prev) => ({ ...prev, [type]: optimistic }));
    setSavingType(type);

    const result = await updateNotificationPreference(type, {
      in_app: optimistic.in_app,
      email: optimistic.email,
    });
    setSavingType(null);

    if (!result.success) {
      // Revert and surface the error.
      setPrefs((prev) => ({ ...prev, [type]: current }));
      setToast({ type: "error", text: result.error || "Couldn't save preference." });
      return;
    }
    setToast({ type: "success", text: "Saved." });
  }

  function handleReset() {
    if (
      !window.confirm(
        "Reset every notification preference to its default? Your customizations will be cleared.",
      )
    )
      return;
    startTransition(async () => {
      const result = await resetNotificationPreferences();
      if (!result.success) {
        setToast({
          type: "error",
          text: result.error || "Couldn't reset preferences.",
        });
        return;
      }
      // Build fresh defaults from initialPrefs (defaults map). Mark all as
      // is_default = true to reflect the reset state.
      setPrefs((prev) => {
        const next: typeof prev = {};
        Object.keys(prev).forEach((k) => {
          // We don't have direct access to defaults here, so trust the
          // initialPrefs snapshot — re-render uses those when matching by type.
          const fromInitial = initialPrefs.find((p) => p.type === k);
          if (fromInitial) {
            next[k] = { ...fromInitial, is_default: true };
          } else {
            next[k] = prev[k];
          }
        });
        return next;
      });
      setToast({ type: "success", text: "Preferences reset." });
    });
  }

  return (
    <div className="space-y-6">
      {/* Email banner — sets expectation that email isn't fully wired for every type yet. */}
      <div
        className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border bg-[#F0F9FF] border-[#BAE6FD]"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        <Info className="size-4 text-[#0284C7] mt-0.5 shrink-0" />
        <p className="text-[13px] text-[#075985]">
          Email notifications are wired for invitations and board adds today.
          Other types accept the preference now; email delivery for them is
          coming soon.
        </p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            role="status"
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-[13px] ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                : "bg-red-50 border-red-100 text-red-700"
            }`}
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {toast.type === "success" ? (
              <Check className="size-4" />
            ) : (
              <span aria-hidden>!</span>
            )}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category cards */}
      {categories.map((cat) => (
        <section
          key={cat.category}
          className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden"
        >
          <header className="px-5 py-4 border-b border-[#F1F5F9]">
            <h2
              className="text-[14px] text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
            >
              {cat.category}
            </h2>
            <p
              className="text-[12px] text-[#6B7280] mt-0.5"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {cat.description}
            </p>
          </header>
          <ul>
            {cat.items.map((item) => {
              const p = prefs[item.type];
              if (!p) return null;
              return (
                <li
                  key={item.type}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-[#F1F5F9] last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] text-[#2D333A] leading-snug"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        fontWeight: 600,
                      }}
                    >
                      {item.label}
                    </p>
                    <p
                      className="text-[12px] text-[#6B7280] mt-0.5"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      {item.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <ToggleCell
                      label="In-app"
                      value={p.in_app}
                      onChange={() => toggle(item.type, "in_app")}
                      saving={savingType === item.type}
                    />
                    <ToggleCell
                      label="Email"
                      value={p.email}
                      onChange={() => toggle(item.type, "email")}
                      saving={savingType === item.type}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6B7280] hover:text-[#2D333A] transition-colors"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          <RotateCcw className="size-3.5" />
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────
function ToggleCell({
  label,
  value,
  onChange,
  saving,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[52px]">
      <span
        className="text-[10px] uppercase tracking-[0.06em] text-[#9CA3AF]"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={`${label} notifications`}
        onClick={onChange}
        disabled={saving}
        className="relative h-5 w-9 rounded-full transition-colors duration-200 disabled:opacity-60"
        style={{
          backgroundColor: value ? "#5CE1A5" : "#E5E7EB",
        }}
      >
        <span
          className="absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{
            transform: value ? "translateX(18px)" : "translateX(2px)",
          }}
        />
        {saving && (
          <Loader2 className="absolute -right-5 top-1 size-3 animate-spin text-[#9CA3AF]" />
        )}
      </button>
    </div>
  );
}
