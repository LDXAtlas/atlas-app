"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────

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

const ALLOWED_PREFERENCES: ModelPreference[] = [
  "speed",
  "balanced",
  "quality",
];

// Default values returned by getOrgAISettings when the org has no row
// yet. Mirrors the column defaults in the live schema so the page can
// render even before the org has saved once.
const DEFAULT_SETTINGS: OrgAISettings = {
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

// ─── Auth helpers ─────────────────────────────────────────

async function loadOrgContext(): Promise<
  | { ok: true; userId: string; organizationId: string; isAdmin: boolean }
  | { ok: false; error: string; code: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated.", code: "UNAUTHENTICATED" };
  }
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) {
    return { ok: false, error: "No organization found.", code: "BAD_INPUT" };
  }
  const role = getRoleFromProfile(profile);
  return {
    ok: true,
    userId: user.id,
    organizationId: profile.organization_id,
    isAdmin: can.editOrganization(role),
  };
}

// ─── Read ─────────────────────────────────────────────────

export async function getOrgAISettings(): Promise<
  ActionResult<OrgAISettings & { isAdmin: boolean; organizationId: string }>
> {
  const ctx = await loadOrgContext();
  if (!ctx.ok) {
    return { success: false, error: ctx.error, code: ctx.code };
  }

  const { data: row } = await supabaseAdmin
    .from("organization_ai_settings")
    .select(
      "voice_tone, terminology, about_church, things_to_avoid, additional_guidelines, model_preference, ai_enabled, updated_by, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  let updaterName: string | null = null;
  if (row?.updated_by) {
    const { data: updater } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", row.updated_by)
      .maybeSingle();
    updaterName =
      updater?.full_name?.trim() ||
      updater?.email?.split("@")[0] ||
      null;
  }

  const settings: OrgAISettings = row
    ? {
        voice_tone: row.voice_tone,
        terminology: row.terminology,
        about_church: row.about_church,
        things_to_avoid: row.things_to_avoid,
        additional_guidelines: row.additional_guidelines,
        model_preference:
          (row.model_preference as ModelPreference) || "balanced",
        ai_enabled: row.ai_enabled !== false,
        updated_by: row.updated_by,
        updated_at: row.updated_at,
        updater_name: updaterName,
      }
    : DEFAULT_SETTINGS;

  return {
    success: true,
    data: {
      ...settings,
      isAdmin: ctx.isAdmin,
      organizationId: ctx.organizationId,
    },
  };
}

// ─── Update ───────────────────────────────────────────────

export interface UpdateOrgAISettingsInput {
  voice_tone?: string | null;
  terminology?: string | null;
  about_church?: string | null;
  things_to_avoid?: string | null;
  additional_guidelines?: string | null;
  model_preference?: ModelPreference;
  ai_enabled?: boolean;
}

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined) return undefined as unknown as string | null;
  if (v === null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function checkLimit(
  field: keyof typeof AI_SETTINGS_LIMITS,
  value: string | null,
): string | null {
  if (!value) return null;
  if (value.length > AI_SETTINGS_LIMITS[field]) {
    return `${field.replace(/_/g, " ")} is too long (max ${AI_SETTINGS_LIMITS[field]} characters).`;
  }
  return null;
}

export async function updateOrgAISettings(
  input: UpdateOrgAISettingsInput,
): Promise<ActionResult<OrgAISettings>> {
  const ctx = await loadOrgContext();
  if (!ctx.ok) {
    return { success: false, error: ctx.error, code: ctx.code };
  }
  if (!ctx.isAdmin) {
    return {
      success: false,
      error: "Only an admin can change the AI Control Center settings.",
      code: "FORBIDDEN",
    };
  }

  const update: Record<string, unknown> = {
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };

  // Guidelines fields — trim, coerce empty to null, enforce per-field limits.
  const fieldOrder: (keyof typeof AI_SETTINGS_LIMITS)[] = [
    "voice_tone",
    "terminology",
    "about_church",
    "things_to_avoid",
    "additional_guidelines",
  ];
  for (const field of fieldOrder) {
    if (field in input) {
      const trimmed = trimOrNull(input[field]);
      const violation = checkLimit(field, trimmed);
      if (violation) {
        return { success: false, error: violation, code: "BAD_INPUT" };
      }
      update[field] = trimmed;
    }
  }

  if (input.model_preference !== undefined) {
    if (!ALLOWED_PREFERENCES.includes(input.model_preference)) {
      return {
        success: false,
        error: "Invalid model preference.",
        code: "BAD_INPUT",
      };
    }
    update.model_preference = input.model_preference;
  }

  if (input.ai_enabled !== undefined) {
    if (typeof input.ai_enabled !== "boolean") {
      return {
        success: false,
        error: "ai_enabled must be a boolean.",
        code: "BAD_INPUT",
      };
    }
    update.ai_enabled = input.ai_enabled;
  }

  // Upsert keyed on organization_id (PK). Defaults from the table take
  // care of the columns we didn't include — no need to spell them out.
  const { error } = await supabaseAdmin
    .from("organization_ai_settings")
    .upsert(
      { organization_id: ctx.organizationId, ...update },
      { onConflict: "organization_id" },
    );
  if (error) {
    console.error("[updateOrgAISettings] Upsert error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/ai");
  revalidatePath("/settings");

  // Return the fresh state so the form can re-anchor without an extra
  // round trip.
  const refreshed = await getOrgAISettings();
  if (!refreshed.success || !refreshed.data) {
    return { success: true };
  }
  const { isAdmin: _ignoreAdmin, organizationId: _ignoreOrg, ...settingsOnly } =
    refreshed.data;
  void _ignoreAdmin;
  void _ignoreOrg;
  return { success: true, data: settingsOnly };
}
