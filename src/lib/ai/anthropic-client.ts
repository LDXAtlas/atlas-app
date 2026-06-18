// Centralized Anthropic client wrapper.
//
// Every Claude call in Atlas goes through callClaude — this is the only
// place we instantiate the SDK or handle retry/timeout/error mapping.
// The public AI entry point (src/lib/ai/index.ts -> callAI) dispatches
// here when the model selector picks an Anthropic model.

import Anthropic from "@anthropic-ai/sdk";

// ─── Types ─────────────────────────────────────────────────

export type ClaudeModel =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001";

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ClaudeUsage = {
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
};

export type ClaudeResponse =
  | { success: true; response: string; usage: ClaudeUsage; model: string }
  | { success: false; error: string };

export interface CallClaudeParams {
  model: ClaudeModel | string;
  /** Task-specific system prompt. When `cachedPrefix` is set, this
   *  portion is sent as a second uncached block per the
   *  AI_CONTROL_CENTER.md layering model — base + org guidelines
   *  cache; the feature's task prompt does not. */
  system: string;
  /** Optional stable system prompt (Atlas base rules + org
   *  guidelines) that's safe to cache across calls. Composed by
   *  callAI() via buildCachedSystemPrefix() in org-context.ts. When
   *  omitted, behaviour is unchanged from before the Control Center
   *  shipped — `system` itself becomes the cached block. */
  cachedPrefix?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Sets cache_control: { type: 'ephemeral' } on the cached block. Default true. */
  enableCaching?: boolean;
  /** Request timeout in ms. Default 60_000. */
  timeout?: number;
}

// ─── Singleton client ──────────────────────────────────────

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local and your deploy environment.",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// ─── Retry helper ──────────────────────────────────────────

const RETRY_BACKOFF_MS = [1000, 2000, 4000];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Anthropic SDK throws structured errors with `status` on rate-limit /
// server failures. Retry only on those — never on 4xx auth / validation.
function isRetryable(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    if (typeof status === "number") {
      return status === 408 || status === 429 || status >= 500;
    }
  }
  // Network-level failures (fetch aborts, DNS, etc.) — also retryable.
  if (err instanceof Error) {
    return /timeout|ECONN|fetch failed|network/i.test(err.message);
  }
  return false;
}

function userFriendlyMessage(err: unknown): string {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    if (status === 401) return "AI service authentication failed.";
    if (status === 403) return "AI service refused the request.";
    if (status === 429)
      return "AI service is busy. Please try again in a moment.";
    if (status === 400) return "AI request was rejected (bad input).";
    if (typeof status === "number" && status >= 500)
      return "AI service is unavailable. Please try again shortly.";
  }
  if (err instanceof Error && err.message) {
    if (/timeout/i.test(err.message)) return "AI request timed out.";
    return err.message;
  }
  return "AI request failed.";
}

// ─── callClaude ────────────────────────────────────────────

export async function callClaude(
  params: CallClaudeParams,
): Promise<ClaudeResponse> {
  const {
    model,
    system,
    cachedPrefix,
    messages,
    maxTokens = 4096,
    temperature = 0.7,
    enableCaching = true,
    timeout = 60_000,
  } = params;

  const client = getAnthropicClient();

  // The Messages API accepts a string system prompt OR an array of
  // text blocks. We use the array form whenever we either have caching
  // on, a cachedPrefix to layer, or both — only marking the stable
  // prefix block with cache_control. The task-specific block stays
  // uncached so it doesn't bloat the cache key.
  //
  // Per AI_CONTROL_CENTER.md:
  //   cached:   Atlas base rules + org guidelines (stable per org)
  //   uncached: feature task prompt (varies per call)
  const systemPayload = (() => {
    if (cachedPrefix && cachedPrefix.length > 0) {
      const blocks: {
        type: "text";
        text: string;
        cache_control?: { type: "ephemeral" };
      }[] = [
        enableCaching
          ? {
              type: "text",
              text: cachedPrefix,
              cache_control: { type: "ephemeral" },
            }
          : { type: "text", text: cachedPrefix },
        { type: "text", text: system },
      ];
      return blocks;
    }
    // Legacy single-block path: preserves the pre-Control-Center
    // behavior for callers that don't pass cachedPrefix (e.g. the
    // admin test endpoint with no org context).
    return enableCaching
      ? [
          {
            type: "text" as const,
            text: system,
            cache_control: { type: "ephemeral" as const },
          },
        ]
      : system;
  })();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt++) {
    try {
      const response = await client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPayload,
          messages,
        },
        { timeout },
      );

      // Response is typed as MessageStream | Message depending on the
      // streaming flag. We're not streaming, so it's always a Message.
      // Response blocks come in a discriminated union (text, thinking,
      // tool_use, etc.). Only text blocks carry user-visible output.
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");

      // Cache hits land under cache_read_input_tokens (cheap) and cache
      // misses under cache_creation_input_tokens (writes a new entry).
      // For accounting, we treat *read* tokens as "cached" since they're
      // billed at a fraction of regular input cost.
      const usage = response.usage as {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      const cached_tokens = usage.cache_read_input_tokens ?? 0;
      const billed_input =
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0);

      return {
        success: true,
        response: text,
        usage: {
          input_tokens: billed_input,
          output_tokens: usage.output_tokens ?? 0,
          cached_tokens,
        },
        model: response.model,
      };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === RETRY_BACKOFF_MS.length - 1) break;
      await sleep(RETRY_BACKOFF_MS[attempt]);
    }
  }

  console.error("[callClaude] Failed after retries:", lastError);
  return { success: false, error: userFriendlyMessage(lastError) };
}
