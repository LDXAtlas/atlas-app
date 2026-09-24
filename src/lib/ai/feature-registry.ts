// AI feature registry — single source of truth for every AI-powered
// capability in Atlas.
//
// This is the cornerstone the Control Center grows around (see
// AI_CONTROL_CENTER.md in the docs Lucas keeps locally). When you ship
// a new AI feature you do TWO things:
//   1. Route its calls through callAI() (or transcribeAudio()).
//   2. Add an entry here.
// That's it. The org guidelines apply automatically, the model
// preference applies tier-bounded, credit + cost accounting flow into
// ai_usage_log, and once the Insights dashboard ships the new feature
// shows up there for free.
//
// Fallback: when an org runs out of credits, callAI can drop to the
// OpenAI fallback model. Set `allowsFallback: false` on anything that
// reads people's situations (meeting content, pastoral follow-ups,
// free-form chat). Verification on 2026-09-24 showed the fallback models
// don't reliably follow Foundation rule 2 (crisis handling); see
// docs/AI_FOUNDATION_TEST_RESULTS_2026-09-24.md, test 7. Unknown keys
// default to NO fallback. An unregistered feature is a bug either way,
// and it's better for that bug to fail loudly with CREDITS_EXHAUSTED
// the first time an org runs out of credits than to silently send
// crisis content to a model that mishandles it.
//
// Important: every `key` below MUST also be present in the
// ai_usage_log.feature CHECK constraint (live in Supabase). Adding a
// new feature key requires a constraint ALTER and a corresponding
// registry entry.

import type { SubscriptionTier } from "./model-selector";

export type AIFeatureKey =
  | "huddle_transcription"
  | "huddle_summary"
  | "huddle_action_extraction"
  | "atlas_ai_chat"
  | "announcement_generation"
  | "sermon_prep"
  | "care_followup"
  | "smart_suggestion"
  | "other";

export interface AIFeatureRegistryEntry {
  key: AIFeatureKey;
  displayName: string;
  description: string;
  /** The tier that unlocks the feature, or null if every tier has it. */
  minTier: SubscriptionTier | null;
  /** Whether the Control Center should expose a per-feature on/off
   *  toggle for it later. Sensitive surfaces (care_followup) default
   *  true so admins can scope AI away from confidential content. */
  canToggle: boolean;
  /** Whether the org's guidelines should compose into the system
   *  prompt for this feature. Default true — switch off for purely
   *  mechanical features where voice doesn't matter. */
  usesGuidelines: boolean;
  /** Whether callAI may drop to the OpenAI fallback when the org is out
   *  of credits. False for anything that can surface crisis content:
   *  the fallback models don't reliably follow Foundation rule 2. */
  allowsFallback: boolean;
}

export const AI_FEATURE_REGISTRY: Record<AIFeatureKey, AIFeatureRegistryEntry> = {
  huddle_transcription: {
    key: "huddle_transcription",
    displayName: "Huddle transcription",
    description:
      "Turns meeting audio into searchable text. Powered by Whisper — not affected by the model preference.",
    minTier: null,
    canToggle: false,
    // Whisper output is raw transcript text. Voice + terminology don't
    // apply at this stage — they apply when the transcript is later
    // summarized.
    usesGuidelines: false,
    // Whisper only; never goes through selectModel or the fallback.
    allowsFallback: true,
  },
  huddle_summary: {
    key: "huddle_summary",
    displayName: "Huddle summary",
    description:
      "Summarizes meeting transcripts. Inherits voice + terminology from your AI guidelines.",
    minTier: null,
    canToggle: false,
    usesGuidelines: true,
    allowsFallback: false,
  },
  huddle_action_extraction: {
    key: "huddle_action_extraction",
    displayName: "Action item extraction",
    description:
      "Pulls candidate action items + decisions from a transcript. Suggestions only — humans accept or edit.",
    minTier: null,
    canToggle: false,
    usesGuidelines: true,
    allowsFallback: false,
  },
  atlas_ai_chat: {
    key: "atlas_ai_chat",
    displayName: "Atlas AI chat",
    description:
      "Conversational assistant that answers ministry-context questions.",
    minTier: null,
    canToggle: false,
    usesGuidelines: true,
    allowsFallback: false,
  },
  announcement_generation: {
    key: "announcement_generation",
    displayName: "Announcement drafting",
    description:
      "Suggests announcement copy in your church's voice.",
    minTier: null,
    canToggle: false,
    usesGuidelines: true,
    allowsFallback: true,
  },
  sermon_prep: {
    key: "sermon_prep",
    displayName: "Sermon prep",
    description:
      "Sermon outline + research support.",
    minTier: "suite",
    canToggle: true,
    usesGuidelines: true,
    allowsFallback: true,
  },
  care_followup: {
    key: "care_followup",
    displayName: "Care follow-up drafts",
    description:
      "Suggests pastoral follow-up wording. Sensitive content — admins can disable independently.",
    minTier: "suite",
    canToggle: true,
    usesGuidelines: true,
    allowsFallback: false,
  },
  smart_suggestion: {
    key: "smart_suggestion",
    displayName: "Smart suggestions",
    description:
      "Lightweight inline AI hints across the product (assignments, tags, scheduling).",
    minTier: null,
    canToggle: true,
    usesGuidelines: true,
    allowsFallback: true,
  },
  other: {
    key: "other",
    displayName: "Other",
    description:
      "Catch-all bucket — used by the admin test endpoint and any unregistered ad-hoc usage.",
    minTier: null,
    canToggle: false,
    // Safer default: catch-all and ad-hoc usage SHOULD inherit org
    // guidelines so any new feature that forgets to register still
    // sounds on-brand. The previous `false` value also caused the
    // /api/ai/test endpoint to silently skip terminology / voice —
    // hiding the bug we spent three rounds debugging.
    usesGuidelines: true,
    allowsFallback: true,
  },
};

export function getFeatureEntry(
  key: string,
): AIFeatureRegistryEntry | null {
  if (key in AI_FEATURE_REGISTRY) {
    return AI_FEATURE_REGISTRY[key as AIFeatureKey];
  }
  return null;
}

/** True if the org guidelines should compose into the system prompt
 *  for the given feature key. Unknown keys default to TRUE so that
 *  ad-hoc usage still feels on-brand — only the registry can opt a
 *  feature out. */
export function featureUsesGuidelines(key: string): boolean {
  const entry = getFeatureEntry(key);
  if (!entry) return true;
  return entry.usesGuidelines;
}

/** True if callAI may use the OpenAI fallback for this feature when the
 *  org is out of credits. Unknown keys default to FALSE (see the header
 *  comment). */
export function featureAllowsFallback(key: string): boolean {
  const entry = getFeatureEntry(key);
  if (!entry) return false;
  return entry.allowsFallback;
}
