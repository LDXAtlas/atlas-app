// Public AI API for Atlas.
//
// Every feature that needs AI imports from this module:
//   import { callAI, transcribeAudio } from "@/lib/ai";
//
// Behind these two functions the system handles:
//   - tier-based model selection
//   - graceful fallback to OpenAI when credits run out
//   - prompt caching on Anthropic system prompts
//   - atomic credit deduction + ai_usage_log auditing
//   - structured error messages safe to show users
//
// Feature code never touches the SDKs or the credit columns directly.

import {
  callClaude,
  type ClaudeMessage,
} from "./anthropic-client";
import {
  callGPTNanoFallback,
  transcribeAudio as openaiTranscribe,
  type GPTChatMessage,
} from "./openai-client";
import { selectModel, type ModelComplexity } from "./model-selector";
import {
  consumeCredits,
  estimateCreditsForCall,
  type AIFeature,
  type AIProvider,
} from "./credit-accounting";
import { getOrgAIContext, buildCachedSystemPrefix } from "./org-context";
import { featureUsesGuidelines } from "./feature-registry";

// Re-export common types for callers.
export type { AIFeature, AIProvider } from "./credit-accounting";
export type { ModelComplexity, ModelSelection } from "./model-selector";

// ─── callAI ────────────────────────────────────────────────

export interface CallAIParams {
  organizationId: string;
  userId: string;
  feature: AIFeature;
  system: string;
  messages: ClaudeMessage[];
  complexity?: ModelComplexity;
  maxTokens?: number;
  enableCaching?: boolean;
  /** Forwarded to the underlying provider call. */
  temperature?: number;
  /** Free-form metadata stored on the ai_usage_log row. */
  metadata?: Record<string, unknown>;
}

export type CallAIResponse =
  | {
      success: true;
      content: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cached_tokens: number;
      };
      model: string;
      provider: AIProvider;
      wasFallback: boolean;
      creditsRemaining: number;
    }
  | { success: false; error: string };

export async function callAI(params: CallAIParams): Promise<CallAIResponse> {
  const {
    organizationId,
    userId,
    feature,
    system,
    messages,
    complexity = "standard",
    maxTokens = 4096,
    enableCaching = true,
    temperature,
    metadata,
  } = params;

  // ─── AI Control Center context (guidelines + preference + master switch).
  //
  // Single small read. Orgs without an organization_ai_settings row
  // get the defaults (no guidelines, balanced, ai_enabled true) —
  // so the existing test endpoint behaves exactly as it did before
  // the Control Center shipped.
  const orgContext = await getOrgAIContext(organizationId);

  // RUNTIME DEBUG (gated by AI_DEBUG=1) — diagnose whether org
  // guidelines actually reach a live callAI() invocation. See
  // VERCEL_DEBUG.md for how to enable in production.
  const aiDebug = process.env.AI_DEBUG === "1";
  if (aiDebug) {
    console.log(
      "[callAI:orgContext]",
      JSON.stringify({
        organizationId,
        feature,
        aiEnabled: orgContext.aiEnabled,
        modelPreference: orgContext.modelPreference,
        guidelinesBlockLength: orgContext.guidelinesBlock.length,
        guidelinesBlockPreview: orgContext.guidelinesBlock.slice(0, 400),
      }),
    );
  }

  // Master switch. When an admin has turned AI off for the whole org
  // the call short-circuits gracefully so features can render
  // "AI turned off" UI instead of a network error.
  if (!orgContext.aiEnabled) {
    return {
      success: false,
      error:
        "AI is turned off for this organization. An admin can re-enable it in Settings > AI Control Center.",
    };
  }

  // Pick the model up front so credit math + downstream dispatch use
  // the same selection. modelPreference is tier-bounded inside
  // selectModel — no org can exceed its tier's cost ceiling.
  const selection = await selectModel({
    organizationId,
    feature,
    complexity,
    modelPreference: orgContext.modelPreference,
  });

  // Compose the cached system prompt prefix: Atlas base rules + org
  // guidelines (when the feature opts in via the registry). Cached
  // content stays stable per org -> ~90% cheaper input on Anthropic.
  // The task-specific `system` passed in by the feature is sent as a
  // separate uncached block downstream.
  const cachedPrefix = featureUsesGuidelines(feature)
    ? buildCachedSystemPrefix(orgContext.guidelinesBlock)
    : buildCachedSystemPrefix(""); // base only; no org guidelines.

  if (aiDebug) {
    console.log(
      "[callAI:cachedPrefix]",
      JSON.stringify({
        organizationId,
        feature,
        featureUsesGuidelines: featureUsesGuidelines(feature),
        cachedPrefixLength: cachedPrefix.length,
        cachedPrefixContainsTerminology: cachedPrefix.includes(
          "REQUIRED TERMINOLOGY",
        ),
        cachedPrefix,
      }),
    );
  }

  // Pre-flight credit estimate is purely informational — actual
  // deduction uses the post-call response token count rounded up to a
  // credit. We keep the estimate for future "you're about to spend X
  // credits" UI affordances.
  estimateCreditsForCall({ model: selection.model, feature });

  // Dispatch.
  let providerResponse:
    | {
        success: true;
        response: string;
        usage: {
          input_tokens: number;
          output_tokens: number;
          cached_tokens: number;
        };
        model: string;
      }
    | { success: false; error: string };

  if (selection.provider === "anthropic") {
    if (aiDebug) {
      console.log(
        "[callAI:dispatch->callClaude]",
        JSON.stringify({
          provider: "anthropic",
          model: selection.model,
          paramsHasCachedPrefix: typeof cachedPrefix === "string",
          cachedPrefixLength: cachedPrefix.length,
          systemLength: system.length,
          systemPreview: system.slice(0, 200),
          enableCaching,
        }),
      );
    }
    providerResponse = await callClaude({
      model: selection.model,
      system,
      cachedPrefix,
      messages,
      maxTokens,
      enableCaching,
      ...(temperature !== undefined ? { temperature } : {}),
    });
  } else {
    const gptMessages: GPTChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    // OpenAI doesn't expose Anthropic-style cache control on the same
    // free tier, but we still want the guidelines to apply when the
    // org falls through to the credit-exhaustion fallback — same
    // voice / terminology regardless of provider. Concatenate into
    // one system string for callGPTNanoFallback's API.
    const fallbackSystem = cachedPrefix
      ? `${cachedPrefix}\n\n${system}`
      : system;
    providerResponse = await callGPTNanoFallback({
      system: fallbackSystem,
      messages: gptMessages,
      maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
    });
  }

  if (!providerResponse.success) {
    return { success: false, error: providerResponse.error };
  }

  // Compute actual credits to deduct. We start from the feature's flat
  // CREDIT_COSTS number and treat that as the "billed" cost — token
  // counts feed into the per-row cost_usd_estimated in the log, not the
  // user-facing credit ledger. This keeps credit math predictable for
  // end users ("a chat message costs ~5 credits") rather than tied to
  // hard-to-predict token counts.
  const creditsToConsume = estimateCreditsForCall({
    model: selection.model,
    feature,
  });

  const consumed = await consumeCredits({
    organizationId,
    userId,
    feature,
    provider: selection.provider,
    model: providerResponse.model || selection.model,
    creditsToConsume,
    inputTokens: providerResponse.usage.input_tokens,
    outputTokens: providerResponse.usage.output_tokens,
    cachedInputTokens: providerResponse.usage.cached_tokens,
    wasFallback: selection.isFallback,
    metadata: {
      ...(metadata ?? {}),
      complexity,
      requested_model: selection.model,
    },
  });

  if (!consumed.success) {
    // RPC failure — the user got their AI response but we couldn't
    // record it. Surface a clear error so the caller can decide whether
    // to show the response anyway. We don't return the content in this
    // path because the ledger and the experience would diverge.
    return { success: false, error: consumed.error };
  }

  return {
    success: true,
    content: providerResponse.response,
    usage: providerResponse.usage,
    model: providerResponse.model || selection.model,
    provider: selection.provider,
    wasFallback: selection.isFallback,
    creditsRemaining: consumed.newRemainingCredits,
  };
}

// ─── transcribeAudio ───────────────────────────────────────

export interface TranscribeParams {
  organizationId: string;
  userId: string;
  audio: Buffer | File | Blob;
  language?: string;
  prompt?: string;
  filename?: string;
  contentType?: string;
}

export type TranscribeResponse =
  | {
      success: true;
      transcript: string;
      segments: { start: number; end: number; text: string }[];
      duration: number;
      creditsRemaining: number;
    }
  | { success: false; error: string };

export async function transcribeAudio(
  params: TranscribeParams,
): Promise<TranscribeResponse> {
  const { organizationId, userId, ...rest } = params;

  const result = await openaiTranscribe(rest);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const audioSeconds = Math.max(0, Math.round(result.duration));
  const creditsToConsume = estimateCreditsForCall({
    model: "whisper-1",
    feature: "huddle_transcription",
    audioSeconds,
  });

  const consumed = await consumeCredits({
    organizationId,
    userId,
    feature: "huddle_transcription",
    provider: "openai",
    model: "whisper-1",
    creditsToConsume,
    audioSeconds,
    wasFallback: false,
    metadata: { language: rest.language, transcript_chars: result.transcript.length },
  });
  if (!consumed.success) {
    return { success: false, error: consumed.error };
  }

  return {
    success: true,
    transcript: result.transcript,
    segments: result.segments,
    duration: result.duration,
    creditsRemaining: consumed.newRemainingCredits,
  };
}
