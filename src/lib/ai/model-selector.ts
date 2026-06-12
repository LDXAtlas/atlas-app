// Single source of truth for "which model are we calling?".
//
// callAI() in src/lib/ai/index.ts asks the selector exactly once per
// request and then dispatches to the matching provider client. Feature
// code never picks a model directly.
//
// Rules:
//   1. If the org has 0 credits remaining -> OpenAI fallback (graceful
//      degradation, not a hard block).
//   2. Ultimate + complex task         -> Claude Opus 4.7
//   3. Workspace                       -> Claude Haiku 4.5
//   4. Suite, or Ultimate non-complex  -> Claude Sonnet 4.6

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  PRIMARY_FALLBACK_MODEL,
  getEffectiveFallbackModel,
} from "./openai-client";

// ─── Types ─────────────────────────────────────────────────

export type ModelProvider = "anthropic" | "openai";

export type ModelComplexity = "simple" | "standard" | "complex";

export type SubscriptionTier = "workspace" | "suite" | "ultimate";

export type ModelSelection = {
  provider: ModelProvider;
  model: string;
  isFallback: boolean;
  /** The tier the model was picked for. Useful for telemetry. */
  modelTier: SubscriptionTier;
};

export interface SelectModelParams {
  organizationId: string;
  /** Feature id — must match the ai_usage_log.feature CHECK constraint. */
  feature: string;
  complexity?: ModelComplexity;
}

// ─── Constants ─────────────────────────────────────────────

export const MODEL_TIERS = {
  workspace: "claude-haiku-4-5-20251001",
  suite: "claude-sonnet-4-6",
  ultimate_standard: "claude-sonnet-4-6",
  ultimate_complex: "claude-opus-4-7",
} as const;

// USD per 1,000,000 tokens. `whisper-1` is priced per minute of audio.
// Update when providers publish new rates.
export const MODEL_PRICING: Record<
  string,
  | { input: number; output: number; cached_input?: number }
  | { per_minute: number }
> = {
  "claude-opus-4-7": { input: 5, output: 25, cached_input: 0.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cached_input: 0.3 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cached_input: 0.1 },
  // OpenAI fallbacks — keep both keyed in so credit accounting works no
  // matter which one the wrapper swapped in at runtime.
  "gpt-5-nano": { input: 0.15, output: 0.6, cached_input: 0.075 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cached_input: 0.075 },
  "whisper-1": { per_minute: 0.006 },
};

// ─── selectModel ───────────────────────────────────────────

export async function selectModel(
  params: SelectModelParams,
): Promise<ModelSelection> {
  const { organizationId, complexity = "standard" } = params;

  // One round trip: tier + remaining credits via the RPC.
  const [{ data: org }, { data: remaining }] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("subscription_tier")
      .eq("id", organizationId)
      .maybeSingle(),
    supabaseAdmin.rpc("get_ai_credits_remaining", {
      p_organization_id: organizationId,
    }),
  ]);

  const rawTier = (org?.subscription_tier as string | null)?.trim().toLowerCase();
  const tier: SubscriptionTier = isTier(rawTier) ? rawTier : "workspace";
  const remainingCredits = typeof remaining === "number" ? remaining : 0;

  // Out of credits -> graceful degrade to OpenAI fallback.
  if (remainingCredits <= 0) {
    // getEffectiveFallbackModel returns the runtime-swapped id when
    // gpt-5-nano isn't available; otherwise it returns the primary.
    const fallback = getEffectiveFallbackModel() || PRIMARY_FALLBACK_MODEL;
    return {
      provider: "openai",
      model: fallback,
      isFallback: true,
      modelTier: tier,
    };
  }

  if (tier === "ultimate" && complexity === "complex") {
    return {
      provider: "anthropic",
      model: MODEL_TIERS.ultimate_complex,
      isFallback: false,
      modelTier: tier,
    };
  }
  if (tier === "workspace") {
    return {
      provider: "anthropic",
      model: MODEL_TIERS.workspace,
      isFallback: false,
      modelTier: tier,
    };
  }
  // Suite, or Ultimate non-complex.
  return {
    provider: "anthropic",
    model: MODEL_TIERS.suite,
    isFallback: false,
    modelTier: tier,
  };
}

// ─── Helpers ───────────────────────────────────────────────

function isTier(v: string | null | undefined): v is SubscriptionTier {
  return v === "workspace" || v === "suite" || v === "ultimate";
}
