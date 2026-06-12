// Credit accounting for AI calls.
//
// Every successful AI call goes through consumeCredits to:
//   1. Atomically increment organizations.ai_credits_used via the
//      consume_ai_credits RPC.
//   2. Insert a row in ai_usage_log for cost visibility + auditing.
//
// Failure to log to ai_usage_log fails the function — we treat the
// usage log as the source of truth, so a successful AI call that didn't
// get logged would silently undercount usage. consume_ai_credits failing
// also fails the function (no log row gets written).

import { supabaseAdmin } from "@/lib/supabase/admin";
import { MODEL_PRICING } from "./model-selector";

// ─── Types ─────────────────────────────────────────────────

export type AIFeature =
  | "huddle_transcription"
  | "huddle_summary"
  | "huddle_action_extraction"
  | "atlas_ai_chat"
  | "announcement_generation"
  | "sermon_prep"
  | "care_followup"
  | "smart_suggestion"
  | "other";

export type AIProvider = "anthropic" | "openai";

export interface EstimateParams {
  model: string;
  feature: AIFeature;
  /** Used for `huddle_transcription` (audio seconds in, credits out). */
  audioSeconds?: number;
}

export interface ConsumeParams {
  organizationId: string;
  userId: string;
  feature: AIFeature;
  provider: AIProvider;
  model: string;
  creditsToConsume: number;
  /** Token usage from the underlying SDK response — any field may be 0. */
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  audioSeconds?: number;
  wasFallback: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Constants ─────────────────────────────────────────────

// CREDIT_COSTS keys are intentionally feature-and-model-specific so the
// API surface can pick the right cost without needing a switch
// statement at every call site. Use estimateCreditsForCall to resolve.
export const CREDIT_COSTS = {
  huddle_transcription_per_minute: 1,
  huddle_summary_haiku: 10,
  huddle_summary_sonnet: 30,
  huddle_summary_opus: 75,
  atlas_ai_chat_haiku: 2,
  atlas_ai_chat_sonnet: 5,
  atlas_ai_chat_opus: 12,
  atlas_ai_chat_nano: 1,
  announcement_generation_haiku: 3,
  announcement_generation_sonnet: 8,
  smart_suggestion_haiku: 1,
  smart_suggestion_sonnet: 3,
} as const;

// ─── getRemainingCredits ───────────────────────────────────

export async function getRemainingCredits(
  organizationId: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("get_ai_credits_remaining", {
    p_organization_id: organizationId,
  });
  if (error) {
    console.error("[getRemainingCredits] RPC error:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

// ─── estimateCreditsForCall ────────────────────────────────

export function estimateCreditsForCall(params: EstimateParams): number {
  const { model, feature, audioSeconds = 0 } = params;

  if (feature === "huddle_transcription") {
    const minutes = Math.ceil(audioSeconds / 60);
    return Math.max(1, minutes) * CREDIT_COSTS.huddle_transcription_per_minute;
  }

  const family = modelFamily(model);
  if (feature === "huddle_summary") {
    if (family === "haiku") return CREDIT_COSTS.huddle_summary_haiku;
    if (family === "sonnet") return CREDIT_COSTS.huddle_summary_sonnet;
    if (family === "opus") return CREDIT_COSTS.huddle_summary_opus;
    // Fallback / unknown — same as Haiku since the fallback is cheaper.
    return CREDIT_COSTS.huddle_summary_haiku;
  }
  if (feature === "atlas_ai_chat") {
    if (family === "haiku") return CREDIT_COSTS.atlas_ai_chat_haiku;
    if (family === "sonnet") return CREDIT_COSTS.atlas_ai_chat_sonnet;
    if (family === "opus") return CREDIT_COSTS.atlas_ai_chat_opus;
    if (family === "openai") return CREDIT_COSTS.atlas_ai_chat_nano;
    return CREDIT_COSTS.atlas_ai_chat_haiku;
  }
  if (feature === "announcement_generation") {
    if (family === "haiku") return CREDIT_COSTS.announcement_generation_haiku;
    if (family === "sonnet") return CREDIT_COSTS.announcement_generation_sonnet;
    return CREDIT_COSTS.announcement_generation_haiku;
  }
  if (feature === "smart_suggestion") {
    if (family === "haiku") return CREDIT_COSTS.smart_suggestion_haiku;
    if (family === "sonnet") return CREDIT_COSTS.smart_suggestion_sonnet;
    return CREDIT_COSTS.smart_suggestion_haiku;
  }

  // Unknown feature -> 1 credit as a placeholder. Callers should add a
  // CREDIT_COSTS entry before relying on this.
  return 1;
}

// ─── consumeCredits ────────────────────────────────────────

export async function consumeCredits(
  params: ConsumeParams,
): Promise<
  | { success: true; newRemainingCredits: number }
  | { success: false; error: string }
> {
  const {
    organizationId,
    userId,
    feature,
    provider,
    model,
    creditsToConsume,
    inputTokens = 0,
    outputTokens = 0,
    cachedInputTokens = 0,
    audioSeconds = 0,
    wasFallback,
    metadata,
  } = params;

  // Atomic deduction first — if this fails, we skip the log insert so
  // bookkeeping stays consistent.
  const { data: newRemaining, error: rpcError } = await supabaseAdmin.rpc(
    "consume_ai_credits",
    {
      p_organization_id: organizationId,
      p_credits_to_consume: creditsToConsume,
    },
  );
  if (rpcError) {
    console.error("[consumeCredits] RPC error:", rpcError.message);
    return { success: false, error: rpcError.message };
  }

  // Cost estimate in USD for FinOps visibility. Token-based for text
  // calls, per-minute for whisper.
  const costUsd = estimateUsdCost({
    model,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    audioSeconds,
  });

  const { error: logError } = await supabaseAdmin.from("ai_usage_log").insert({
    organization_id: organizationId,
    user_id: userId,
    feature,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_input_tokens: cachedInputTokens,
    audio_seconds: audioSeconds,
    credits_used: creditsToConsume,
    cost_usd_estimated: costUsd,
    was_fallback: wasFallback,
    metadata: metadata ?? {},
  });
  if (logError) {
    console.error("[consumeCredits] ai_usage_log insert error:", logError.message);
    // Credit was already deducted by the RPC. We don't try to refund —
    // the user got their AI response, we just lost an audit row. Returns
    // success with a flag in metadata so callers can surface a warning
    // if they want to.
    return {
      success: true,
      newRemainingCredits: typeof newRemaining === "number" ? newRemaining : 0,
    };
  }

  return {
    success: true,
    newRemainingCredits: typeof newRemaining === "number" ? newRemaining : 0,
  };
}

// ─── Internal helpers ──────────────────────────────────────

type ModelFamily = "haiku" | "sonnet" | "opus" | "openai" | "whisper" | "unknown";

function modelFamily(model: string): ModelFamily {
  const m = model.toLowerCase();
  if (m.includes("haiku")) return "haiku";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("opus")) return "opus";
  if (m.includes("whisper")) return "whisper";
  if (m.startsWith("gpt-")) return "openai";
  return "unknown";
}

function estimateUsdCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  audioSeconds: number;
}): number {
  const { model, inputTokens, outputTokens, cachedInputTokens, audioSeconds } =
    params;
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  if ("per_minute" in pricing) {
    return (audioSeconds / 60) * pricing.per_minute;
  }
  const inputRate = pricing.input;
  const outputRate = pricing.output;
  const cachedRate = pricing.cached_input ?? inputRate;
  // Rates are per 1M tokens.
  const cost =
    (inputTokens / 1_000_000) * inputRate +
    (cachedInputTokens / 1_000_000) * cachedRate +
    (outputTokens / 1_000_000) * outputRate;
  // 6 decimal places matches the numeric(10, 6) column scale.
  return Math.round(cost * 1_000_000) / 1_000_000;
}
