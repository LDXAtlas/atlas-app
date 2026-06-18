"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  Check,
  Crown,
  Loader2,
  Power,
  Rocket,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  AI_SETTINGS_LIMITS,
  updateOrgAISettings,
  type ModelPreference,
  type OrgAISettings,
} from "@/app/actions/ai-settings";

interface AISettingsFormProps {
  initial: OrgAISettings & { isAdmin: boolean };
  tier: "workspace" | "suite" | "ultimate" | null;
}

// ─── Top-level form ───────────────────────────────────────

export function AISettingsForm({ initial, tier }: AISettingsFormProps) {
  const [settings, setSettings] = useState<OrgAISettings>(initial);
  const [voiceTone, setVoiceTone] = useState(initial.voice_tone ?? "");
  const [terminology, setTerminology] = useState(initial.terminology ?? "");
  const [aboutChurch, setAboutChurch] = useState(initial.about_church ?? "");
  const [thingsToAvoid, setThingsToAvoid] = useState(initial.things_to_avoid ?? "");
  const [additional, setAdditional] = useState(initial.additional_guidelines ?? "");
  const [preference, setPreference] = useState<ModelPreference>(
    initial.model_preference,
  );
  const [aiEnabled, setAiEnabled] = useState<boolean>(initial.ai_enabled);

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isAdmin = initial.isAdmin;

  const dirty = useMemo(() => {
    return (
      (voiceTone.trim() || null) !== (settings.voice_tone || null) ||
      (terminology.trim() || null) !== (settings.terminology || null) ||
      (aboutChurch.trim() || null) !== (settings.about_church || null) ||
      (thingsToAvoid.trim() || null) !== (settings.things_to_avoid || null) ||
      (additional.trim() || null) !== (settings.additional_guidelines || null) ||
      preference !== settings.model_preference ||
      aiEnabled !== settings.ai_enabled
    );
  }, [
    voiceTone,
    terminology,
    aboutChurch,
    thingsToAvoid,
    additional,
    preference,
    aiEnabled,
    settings,
  ]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  function persist<T>(
    partial: Parameters<typeof updateOrgAISettings>[0],
    optimistic: () => void,
    revert: () => void,
    successLabel?: string,
  ): Promise<T | null> {
    return new Promise((resolve) => {
      setError(null);
      optimistic();
      startTransition(async () => {
        const res = await updateOrgAISettings(partial);
        if (!res.success) {
          revert();
          setError(res.error);
          resolve(null);
          return;
        }
        if (res.data) {
          setSettings(res.data);
          setVoiceTone(res.data.voice_tone ?? "");
          setTerminology(res.data.terminology ?? "");
          setAboutChurch(res.data.about_church ?? "");
          setThingsToAvoid(res.data.things_to_avoid ?? "");
          setAdditional(res.data.additional_guidelines ?? "");
          setPreference(res.data.model_preference);
          setAiEnabled(res.data.ai_enabled);
        }
        if (successLabel) flash(successLabel);
        resolve(null as unknown as T);
      });
    });
  }

  function handleSaveGuidelines() {
    persist(
      {
        voice_tone: voiceTone,
        terminology,
        about_church: aboutChurch,
        things_to_avoid: thingsToAvoid,
        additional_guidelines: additional,
      },
      () => {},
      () => {},
      "Guidelines saved",
    );
  }

  function handleCancelGuidelines() {
    setVoiceTone(settings.voice_tone ?? "");
    setTerminology(settings.terminology ?? "");
    setAboutChurch(settings.about_church ?? "");
    setThingsToAvoid(settings.things_to_avoid ?? "");
    setAdditional(settings.additional_guidelines ?? "");
    setError(null);
  }

  function handlePreferenceChange(next: ModelPreference) {
    const previous = preference;
    persist(
      { model_preference: next },
      () => setPreference(next),
      () => setPreference(previous),
      "Model preference saved",
    );
  }

  function handleToggleAI() {
    const previous = aiEnabled;
    const next = !aiEnabled;
    persist(
      { ai_enabled: next },
      () => setAiEnabled(next),
      () => setAiEnabled(previous),
      next ? "AI turned on" : "AI turned off",
    );
  }

  const guidelinesDirty =
    (voiceTone.trim() || null) !== (settings.voice_tone || null) ||
    (terminology.trim() || null) !== (settings.terminology || null) ||
    (aboutChurch.trim() || null) !== (settings.about_church || null) ||
    (thingsToAvoid.trim() || null) !== (settings.things_to_avoid || null) ||
    (additional.trim() || null) !== (settings.additional_guidelines || null);

  return (
    <div className="space-y-5">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
              <p
                className="text-[13px] text-red-700"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {error}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isAdmin && <ReadOnlyBanner />}
      {!aiEnabled && <AIOffBanner />}

      <GuidelinesCard
        voiceTone={voiceTone}
        setVoiceTone={setVoiceTone}
        terminology={terminology}
        setTerminology={setTerminology}
        aboutChurch={aboutChurch}
        setAboutChurch={setAboutChurch}
        thingsToAvoid={thingsToAvoid}
        setThingsToAvoid={setThingsToAvoid}
        additional={additional}
        setAdditional={setAdditional}
        disabled={!isAdmin || pending}
        dirty={guidelinesDirty}
        onSave={handleSaveGuidelines}
        onCancel={handleCancelGuidelines}
        pending={pending}
      />

      <ModelPreferenceCard
        value={preference}
        onChange={handlePreferenceChange}
        tier={tier}
        disabled={!isAdmin || pending}
      />

      <MasterSwitchCard
        enabled={aiEnabled}
        onToggle={handleToggleAI}
        disabled={!isAdmin || pending}
      />

      <InsightsStub />

      {settings.updater_name && settings.updated_at && (
        <p
          className="text-[12px] text-[#9CA3AF] text-center"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Last updated by {settings.updater_name} ·{" "}
          {new Date(settings.updated_at).toLocaleString()}
        </p>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#0F172A] text-white text-[13px] shadow-2xl inline-flex items-center gap-2"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            role="status"
          >
            <Check className="size-3.5" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keep dirty in scope so we can show the Save button styling
          state matches the user's recent edits — used downstream. */}
      <span hidden aria-hidden="true">
        {dirty ? "dirty" : "clean"}
      </span>
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────

function GuidelinesCard({
  voiceTone,
  setVoiceTone,
  terminology,
  setTerminology,
  aboutChurch,
  setAboutChurch,
  thingsToAvoid,
  setThingsToAvoid,
  additional,
  setAdditional,
  disabled,
  dirty,
  pending,
  onSave,
  onCancel,
}: {
  voiceTone: string;
  setVoiceTone: (v: string) => void;
  terminology: string;
  setTerminology: (v: string) => void;
  aboutChurch: string;
  setAboutChurch: (v: string) => void;
  thingsToAvoid: string;
  setThingsToAvoid: (v: string) => void;
  additional: string;
  setAdditional: (v: string) => void;
  disabled: boolean;
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <header className="mb-4">
        <h3
          className="text-[15px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Guidelines
        </h3>
        <p
          className="text-[13px] text-[#6B7280] mt-1 leading-relaxed"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Shape how AI sounds for your church and what context it has.
          Guidelines apply automatically to every AI feature in Atlas
          (chat, huddle summaries, announcements, more). Base Atlas
          rules around accuracy and safety always take priority.
        </p>
      </header>
      <div className="space-y-4">
        <GuidelineField
          label="Voice & tone"
          hint='Examples: "Warm and pastoral", "Concise and direct", "Encouraging".'
          value={voiceTone}
          onChange={setVoiceTone}
          max={AI_SETTINGS_LIMITS.voice_tone}
          disabled={disabled}
          rows={2}
        />
        <GuidelineField
          label="Terminology"
          hint='Examples: "We say \"life groups\" not \"small groups\"". "Use \"guest\" instead of \"visitor\"".'
          value={terminology}
          onChange={setTerminology}
          max={AI_SETTINGS_LIMITS.terminology}
          disabled={disabled}
          rows={3}
        />
        <GuidelineField
          label="About your church"
          hint="Mission, values, and context the AI should be aware of."
          value={aboutChurch}
          onChange={setAboutChurch}
          max={AI_SETTINGS_LIMITS.about_church}
          disabled={disabled}
          rows={3}
        />
        <GuidelineField
          label="Things to avoid"
          hint="Language, topics, or framings to keep out of AI output."
          value={thingsToAvoid}
          onChange={setThingsToAvoid}
          max={AI_SETTINGS_LIMITS.things_to_avoid}
          disabled={disabled}
          rows={3}
        />
        <GuidelineField
          label="Additional guidelines"
          hint="Anything else worth knowing — preferred greetings, structure preferences, scripture translation choices, etc."
          value={additional}
          onChange={setAdditional}
          max={AI_SETTINGS_LIMITS.additional_guidelines}
          disabled={disabled}
          rows={4}
        />
      </div>
      <footer className="mt-5 pt-4 border-t border-[#F1F5F9] flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={!dirty || pending || disabled}
          className="h-9 px-3 rounded-xl text-[13px] text-[#6B7280] hover:bg-[#F4F5F7] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || pending || disabled}
          className="h-9 px-4 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#4DD395] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="size-3.5" />
              Save guidelines
            </>
          )}
        </button>
      </footer>
    </section>
  );
}

function GuidelineField({
  label,
  hint,
  value,
  onChange,
  max,
  disabled,
  rows,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  disabled: boolean;
  rows: number;
}) {
  const remaining = Math.max(0, max - value.length);
  const over = value.length > max;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label
          className="text-[11px] uppercase tracking-wider text-[#9CA3AF]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
        >
          {label}
        </label>
        <span
          className={`text-[11px] tabular-nums ${over ? "text-red-600" : "text-[#9CA3AF]"}`}
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {remaining} left
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        maxLength={max + 200 /* hard cap; server still enforces max */}
        className={`w-full px-3 py-2 rounded-xl border text-[13.5px] outline-none focus:border-[#5CE1A5] resize-vertical disabled:bg-[#F8FAFC] disabled:cursor-not-allowed ${
          over ? "border-red-300" : "border-[#E5E7EB]"
        }`}
        style={{ fontFamily: "var(--font-source-sans)" }}
      />
      <p
        className="text-[11.5px] text-[#9CA3AF] mt-1"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        {hint}
      </p>
    </div>
  );
}

function ModelPreferenceCard({
  value,
  onChange,
  tier,
  disabled,
}: {
  value: ModelPreference;
  onChange: (next: ModelPreference) => void;
  tier: "workspace" | "suite" | "ultimate" | null;
  disabled: boolean;
}) {
  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <header className="mb-4">
        <h3
          className="text-[15px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Model preference
        </h3>
        <p
          className="text-[13px] text-[#6B7280] mt-1 leading-relaxed"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Picks how AI balances speed and depth — within your plan&rsquo;s
          limits. Whisper transcription and the credit-saving fallback
          aren&rsquo;t affected.
        </p>
      </header>
      <div className="space-y-2">
        <PreferenceOption
          value="speed"
          label="Speed"
          description="Faster responses, lighter processing. Best for short, simple tasks."
          icon={<Zap className="size-4 text-[#F59E0B]" />}
          selected={value === "speed"}
          onSelect={() => onChange("speed")}
          disabled={disabled}
        />
        <PreferenceOption
          value="balanced"
          label="Balanced"
          description="A good mix of speed and depth. Recommended for most churches."
          icon={<Rocket className="size-4 text-[#3B82F6]" />}
          selected={value === "balanced"}
          onSelect={() => onChange("balanced")}
          disabled={disabled}
        />
        <PreferenceOption
          value="quality"
          label="Quality"
          description="Most thorough and detailed. Slower, costs more credits per call."
          icon={<Crown className="size-4 text-[#F97316]" />}
          selected={value === "quality"}
          onSelect={() => onChange("quality")}
          disabled={disabled}
        />
      </div>
      {tier === "workspace" && (
        <div
          className="mt-4 p-3 rounded-xl bg-[#5CE1A5]/10 border border-[#5CE1A5]/30 flex items-start gap-2"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <Sparkles className="size-4 text-[#059669] mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] text-[#0F172A]">
              You&rsquo;re on Workspace, which uses the fast Haiku model
              regardless of preference. Upgrade to Suite for higher-
              quality AI responses on summaries and chat.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function PreferenceOption({
  label,
  description,
  icon,
  selected,
  onSelect,
  disabled,
}: {
  value: ModelPreference;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
        selected
          ? "border-[#5CE1A5] bg-[#5CE1A5]/5"
          : "border-[#E5E7EB] hover:bg-[#F4F5F7]"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <input
        type="radio"
        name="model-preference"
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
        className="mt-1 text-[#5CE1A5] focus:ring-[#5CE1A5]"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          {icon}
          <p
            className="text-[13px] text-[#0F172A]"
            style={{
              fontFamily: "var(--font-poppins)",
              fontWeight: 700,
            }}
          >
            {label}
          </p>
        </div>
        <p
          className="text-[12.5px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {description}
        </p>
      </div>
    </label>
  );
}

function MasterSwitchCard({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 flex items-center gap-4 flex-wrap">
      <div
        className="size-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: enabled ? "#5CE1A51A" : "#FEE2E2",
          color: enabled ? "#059669" : "#DC2626",
        }}
      >
        <Power className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className="text-[15px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          AI {enabled ? "on" : "off"} for this organization
        </h3>
        <p
          className="text-[13px] text-[#6B7280] mt-1 max-w-md leading-relaxed"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {enabled
            ? "AI features (summaries, chat, action item extraction, smart suggestions) are available across Atlas. Per-feature toggles are coming soon."
            : "All AI features are paused. Feature surfaces will show an “AI turned off” notice instead of generating output. You can turn AI back on at any time."}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={enabled}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          enabled ? "bg-[#5CE1A5]" : "bg-[#CBD5E1]"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow transform transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </section>
  );
}

function InsightsStub() {
  return (
    <section className="bg-[#F8FAFC] border border-dashed border-[#E5E7EB] rounded-2xl p-5">
      <header className="flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-[#8B5CF6]" />
        <h3
          className="text-[15px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Insights · coming soon
        </h3>
      </header>
      <p
        className="text-[13px] text-[#6B7280] max-w-2xl leading-relaxed"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        This area will show how AI is performing for your church: credits
        used vs. plan limit, breakdown by feature, acceptance rate on AI
        suggestions, and feature adoption. We&rsquo;ll ship it once there&rsquo;s
        enough real usage to make the metrics meaningful instead of a
        blank dashboard.
      </p>
    </section>
  );
}

function ReadOnlyBanner() {
  return (
    <div className="px-4 py-3 rounded-xl bg-[#F4F5F7] border border-[#E5E7EB] flex items-start gap-2">
      <AlertCircle className="size-4 text-[#6B7280] mt-0.5 shrink-0" />
      <p
        className="text-[13px] text-[#6B7280]"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        Only an admin can change the AI Control Center settings. You can
        see what&rsquo;s configured but the controls below are read-only.
      </p>
    </div>
  );
}

function AIOffBanner() {
  return (
    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
      <Power className="size-4 text-red-600 mt-0.5 shrink-0" />
      <p
        className="text-[13px] text-red-700"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        AI is currently turned off for this organization. No AI features
        will generate output until an admin re-enables it below.
      </p>
    </div>
  );
}
