"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type KeyboardEvent,
  type Ref,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { searchProfiles } from "@/app/actions/profiles";

// Comment content uses an inline token format that's cheap to parse on
// the server (regex for notification routing) and on the client (split
// for rendering): @[Full Name](profile-uuid)
//
// The picker inserts these tokens; the renderer below turns them back
// into pills.

export type MentionInputHandle = {
  focus: () => void;
  clear: () => void;
};

interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  /** Submit when Cmd/Ctrl+Enter is pressed. */
  submitOnCmdEnter?: boolean;
  className?: string;
}

type Suggestion = { id: string; full_name: string; email: string | null };

export const MentionInput = forwardRef(function MentionInput(
  {
    value,
    onChange,
    onSubmit,
    placeholder = "Write a comment… use @ to mention someone",
    rows = 3,
    disabled,
    submitOnCmdEnter = true,
    className,
  }: MentionInputProps,
  ref: Ref<MentionInputHandle>,
) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [trigger, setTrigger] = useState<{
    start: number; // index of "@" in `value`
    query: string;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    clear: () => onChange(""),
  }));

  // Debounced profile search when the trigger is active.
  useEffect(() => {
    if (!trigger) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const res = await searchProfiles(trigger.query);
      if (cancelled) return;
      setSuggestions(
        (res.data || []).slice(0, 8).map((p) => ({
          id: p.id,
          full_name: p.full_name || p.email?.split("@")[0] || "Teammate",
          email: p.email,
        })),
      );
      setActiveIdx(0);
      setLoading(false);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trigger]);

  // Refresh the trigger state every time the input changes — the cursor
  // location is the source of truth for "are we inside an @-token?".
  const recomputeTrigger = useCallback(
    (text: string, caret: number) => {
      // Find the most recent "@" before the caret. Bail if there's a
      // whitespace breaker between the @ and the caret.
      const upto = text.slice(0, caret);
      const at = upto.lastIndexOf("@");
      if (at < 0) return setTrigger(null);
      // Must be at start of string or preceded by whitespace (so we don't
      // fire on email addresses like "user@example.com").
      const prevChar = at === 0 ? " " : upto[at - 1];
      if (!/\s|[(\[{,]/.test(prevChar)) return setTrigger(null);
      const query = upto.slice(at + 1);
      // Bail on multi-word queries to keep this scoped — most mention
      // pickers in the wild stop at the first space.
      if (/\s/.test(query)) return setTrigger(null);
      if (query.length > 32) return setTrigger(null);
      setTrigger({ start: at, query });
    },
    [],
  );

  function handleChange(text: string) {
    onChange(text);
    const caret = taRef.current?.selectionStart ?? text.length;
    recomputeTrigger(text, caret);
  }

  function applySuggestion(s: Suggestion) {
    if (!trigger) return;
    const before = value.slice(0, trigger.start);
    const afterStart = trigger.start + 1 + trigger.query.length;
    const after = value.slice(afterStart);
    const token = `@[${s.full_name}](${s.id})`;
    const next = `${before}${token} ${after}`;
    onChange(next);
    setTrigger(null);
    setSuggestions([]);
    // Restore caret to just after the inserted token.
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      const pos = before.length + token.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (trigger && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTrigger(null);
        return;
      }
    }
    if (
      submitOnCmdEnter &&
      e.key === "Enter" &&
      (e.metaKey || e.ctrlKey) &&
      onSubmit
    ) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        rows={rows}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onSelect={() => {
          const caret = taRef.current?.selectionStart ?? value.length;
          recomputeTrigger(value, caret);
        }}
        className={
          className ??
          "w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none focus:border-[#5CE1A5] transition-colors resize-none"
        }
        style={{ fontFamily: "var(--font-source-sans)" }}
      />
      <AnimatePresence>
        {trigger && (suggestions.length > 0 || loading) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden z-50"
          >
            {loading && suggestions.length === 0 ? (
              <div
                className="px-3 py-2 text-[12px] text-[#9CA3AF]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                Searching…
              </div>
            ) : (
              <ul className="max-h-56 overflow-auto">
                {suggestions.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => applySuggestion(s)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
                        i === activeIdx ? "bg-[#F4F5F7]" : ""
                      }`}
                    >
                      <span
                        className="size-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-[#0F172A] shrink-0"
                        style={{ backgroundColor: "#5CE1A5" }}
                      >
                        {initials(s.full_name)}
                      </span>
                      <span
                        className="text-[13px] text-[#2D333A] truncate"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {s.full_name}
                      </span>
                      {s.email && (
                        <span
                          className="text-[11px] text-[#9CA3AF] truncate ml-auto"
                          style={{
                            fontFamily: "var(--font-source-sans)",
                          }}
                        >
                          {s.email}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Renderer ──────────────────────────────────────────────
//
// Splits a comment body into a mix of plain-text strings and mention
// pills. Cheap: a single regex split + map.

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;

export function MentionRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const parts = useMemo(() => {
    const out: ({ kind: "text"; text: string } | { kind: "mention"; name: string; id: string })[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(MENTION_TOKEN_RE.source, "g");
    while ((match = re.exec(content)) !== null) {
      if (match.index > lastIndex) {
        out.push({ kind: "text", text: content.slice(lastIndex, match.index) });
      }
      out.push({ kind: "mention", name: match[1], id: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      out.push({ kind: "text", text: content.slice(lastIndex) });
    }
    return out;
  }, [content]);

  return (
    <div
      className={
        className ??
        "text-[14px] text-[#2D333A] leading-relaxed whitespace-pre-wrap break-words"
      }
      style={{ fontFamily: "var(--font-source-sans)" }}
    >
      {parts.map((p, i) =>
        p.kind === "mention" ? (
          <span
            key={i}
            className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-md bg-[#D1FAE5] text-[#059669] text-[13px] font-semibold mx-[1px]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            @{p.name}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "·";
}
