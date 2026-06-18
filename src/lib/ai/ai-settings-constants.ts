// Non-server constants and types for AI Control Center.
//
// Kept out of src/app/actions/ai-settings.ts because that file uses
// the "use server" directive — Next.js requires such files to export
// ONLY async functions. Importing these from a plain lib file is safe
// from both client components and server actions.

export type ModelPreference = "speed" | "balanced" | "quality";

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

export interface OrgAISettings {
  voice_tone: string | null;
  terminology: string | null;
  about_church: string | null;
  things_to_avoid: string | null;
  additional_guidelines: string | null;
  model_preference: ModelPreference;
  ai_enabled: boolean;
  updated_by: string | null;
  updated_at: string | null;
  updater_name: string | null;
}

export interface UpdateOrgAISettingsInput {
  voice_tone?: string | null;
  terminology?: string | null;
  about_church?: string | null;
  things_to_avoid?: string | null;
  additional_guidelines?: string | null;
  model_preference?: ModelPreference;
  ai_enabled?: boolean;
}

// Application-level character limits — enforced server-side. Keeps
// the cached prompt size predictable and bounds the cost of every
// AI call.
export const AI_SETTINGS_LIMITS = {
  voice_tone: 500,
  terminology: 1000,
  about_church: 1000,
  things_to_avoid: 1000,
  additional_guidelines: 2000,
} as const;

export const ALLOWED_MODEL_PREFERENCES: ModelPreference[] = [
  "speed",
  "balanced",
  "quality",
];

// Default values returned by getOrgAISettings when the org has no row
// yet. Mirrors the column defaults in the live schema so the page can
// render even before the org has saved once.
export const DEFAULT_AI_SETTINGS: OrgAISettings = {
  voice_tone: null,
  terminology: null,
  about_church: null,
  things_to_avoid: null,
  additional_guidelines: null,
  model_preference: "balanced",
  ai_enabled: true,
  updated_by: null,
  updated_at: null,
  updater_name: null,
};
