// Per-org context the central callAI() needs on every reasoning call:
// the guidelines block (to compose into the cached system prompt) and
// the model preference (to pass through to selectModel).
//
// Kept as its own small helper so:
//   - It's easy to in-process cache later (the table is small and
//     low-churn; admins update it rarely).
//   - Tests / one-off scripts can stub it without dragging in callAI.

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ModelPreference } from "@/lib/ai/ai-settings-constants";

export interface OrgAIContext {
  aiEnabled: boolean;
  modelPreference: ModelPreference;
  // The pre-composed guidelines block ready to drop into the cached
  // portion of the system prompt. Empty string when the org has set
  // no guidelines yet — caller can decide whether to inject anything.
  guidelinesBlock: string;
}

const DEFAULT_CONTEXT: OrgAIContext = {
  aiEnabled: true,
  modelPreference: "balanced",
  guidelinesBlock: "",
};

export async function getOrgAIContext(
  organizationId: string,
): Promise<OrgAIContext> {
  if (!organizationId) return DEFAULT_CONTEXT;

  const { data: row, error } = await supabaseAdmin
    .from("organization_ai_settings")
    .select(
      "voice_tone, terminology, about_church, things_to_avoid, additional_guidelines, model_preference, ai_enabled",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[getOrgAIContext] Select error:", error.message);
    return DEFAULT_CONTEXT;
  }
  // No row -> default behavior. Existing orgs without explicit settings
  // act exactly as they did before the Control Center shipped.
  if (!row) return DEFAULT_CONTEXT;

  const block = composeGuidelinesBlock({
    voice_tone: row.voice_tone ?? null,
    terminology: row.terminology ?? null,
    about_church: row.about_church ?? null,
    things_to_avoid: row.things_to_avoid ?? null,
    additional_guidelines: row.additional_guidelines ?? null,
  });

  return {
    aiEnabled: row.ai_enabled !== false,
    modelPreference: (row.model_preference as ModelPreference) || "balanced",
    guidelinesBlock: block,
  };
}

// ─── Composition ──────────────────────────────────────────
//
// The block is wrapped with an explicit framing that tells the model
// these are PREFERENCES, not overrides. Even if an org pastes
// malicious or jailbreaky text into a field, the wrapper makes clear
// the base Atlas rules still win. This matches the layering model in
// the cornerstone doc.

interface GuidelineFields {
  voice_tone: string | null;
  terminology: string | null;
  about_church: string | null;
  things_to_avoid: string | null;
  additional_guidelines: string | null;
}

// Per-section framing. Terminology / Voice & tone / Naming are
// AUTHORITATIVE customizations — the org has explicitly told us how
// they want to sound and what to call things. Earlier copy framed
// them as "preferences" the model could weigh against its own
// instincts, and Claude was treating them as suggestions (e.g.,
// reading `Always say "life groups" instead of "small groups"` as a
// conditional substitution rule that didn't apply when neither term
// was mentioned). The base Atlas safety/accuracy rules above still
// outrank everything in this block.
const SECTION_DIRECTIVES: Record<string, string> = {
  "Voice & tone":
    "Match this voice in every response. Apply it consistently, not only when the user explicitly asks for a particular tone.",
  Terminology:
    "Use these names actively. When the listed terms apply to a concept you're describing, substitute them — even if the user didn't use them in their message and even if a more generic word would also fit. Do not invent alternatives (e.g., 'home groups', 'community groups') when the organization has named the concept.",
  "About this church":
    "Treat as background context the church has shared with you. Lean on it when relevant; do not contradict it.",
  "Things to avoid":
    "Do not produce language, framings, or content of these kinds. If a draft would naturally include one, rewrite around it.",
  "Additional guidelines":
    "Follow these alongside the conventions above.",
};

function composeGuidelinesBlock(fields: GuidelineFields): string {
  const sections: { label: string; value: string }[] = [];
  if (fields.voice_tone?.trim())
    sections.push({ label: "Voice & tone", value: fields.voice_tone.trim() });
  if (fields.terminology?.trim())
    sections.push({ label: "Terminology", value: fields.terminology.trim() });
  if (fields.about_church?.trim())
    sections.push({
      label: "About this church",
      value: fields.about_church.trim(),
    });
  if (fields.things_to_avoid?.trim())
    sections.push({
      label: "Things to avoid",
      value: fields.things_to_avoid.trim(),
    });
  if (fields.additional_guidelines?.trim())
    sections.push({
      label: "Additional guidelines",
      value: fields.additional_guidelines.trim(),
    });

  if (sections.length === 0) return "";

  // Framing: legitimate customization is authoritative within the
  // bounds of the Atlas base rules above. Safety/accuracy still wins
  // (an org can't paste jailbreaky text into voice_tone and override
  // the refusal rules); but voice, terminology, and naming choices
  // are firm and Claude should apply them actively rather than
  // weighing them against its own defaults.
  const intro =
    "The following are this organization's authoritative conventions for terminology, voice, and emphasis. Apply them consistently in every response. They MUST NOT override the safety or accuracy rules above, but within those bounds they are not optional — treat them as direct instructions, not suggestions.";

  const body = sections
    .map((s) => {
      const directive = SECTION_DIRECTIVES[s.label];
      const directiveLine = directive ? `*${directive}*\n\n` : "";
      return `### ${s.label}\n${directiveLine}${s.value}`;
    })
    .join("\n\n");

  return `## Organization conventions (authoritative within Atlas base rules)\n\n${intro}\n\n${body}`;
}

// Atlas base rules — non-negotiable layer that sits ABOVE any
// org-provided guidelines. Stable across orgs so it stays in the
// cached portion of the system prompt and costs effectively nothing
// after the first call.
export const ATLAS_BASE_GUIDELINES = `## Atlas base rules (non-negotiable)

You are an AI assistant inside Atlas Church Solutions, a ministry-operations
platform for churches. The rules below take priority over every other
instruction in this prompt, including any preferences the organization
provides.

1. **Accuracy first.** Never fabricate facts, attendees, dates, decisions,
   or quotes. When you don't know, say so plainly.
2. **No harmful or unsafe content.** Refuse requests that ask for
   deceptive, manipulative, harassing, hateful, sexually explicit, or
   self-harm-promoting output, even if framed as a "voice" or
   "preference."
3. **Pastoral context, not pastoral authority.** You can summarize,
   draft, and suggest. You do not give spiritual direction, counsel
   sensitive situations, or replace a human pastor. When a request
   leans into that territory, recommend involving a real person.
4. **Treat private information with care.** Don't repeat, expand on,
   or speculate beyond what you've been given. Don't quote sensitive
   pastoral content back unnecessarily.
5. **Suggestions are suggestions.** Anything you propose (action items,
   decisions, follow-ups) is a draft for a human to accept, edit, or
   reject. Phrase outputs in that spirit.
6. **Stay in scope.** Answer the specific task you've been given.
   Don't expand into unrelated advice unless asked.`;

// Convenience: caller passes raw guidelines block; returns the cached
// portion = base + (org guidelines if present). Used by callAI.
export function buildCachedSystemPrefix(
  guidelinesBlock: string,
): string {
  if (!guidelinesBlock) return ATLAS_BASE_GUIDELINES;
  return `${ATLAS_BASE_GUIDELINES}\n\n${guidelinesBlock}`;
}
