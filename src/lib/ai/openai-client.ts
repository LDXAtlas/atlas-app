// Centralized OpenAI client wrapper.
//
// Two distinct use cases:
//   1. Whisper transcription (no Anthropic equivalent).
//   2. GPT chat fallback when an org has exhausted its credits — we
//      degrade gracefully to the cheapest available chat model rather
//      than hard-blocking.
//
// The fallback model id is intentionally configurable. gpt-5-nano is the
// preferred fallback but its availability depends on rollout; if the API
// rejects it at runtime we automatically retry the same request against
// gpt-4o-mini and log a clear note.

import OpenAI from "openai";

// ─── Types ─────────────────────────────────────────────────

export type WhisperResponse =
  | {
      success: true;
      transcript: string;
      segments: { start: number; end: number; text: string }[];
      duration: number;
    }
  | { success: false; error: string };

export type GPTChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type GPTChatResponse =
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

export interface TranscribeAudioParams {
  audio: Buffer | File | Blob;
  language?: string;
  /** Optional context Whisper uses as decoder priming for accuracy. */
  prompt?: string;
  /** Defaults to `audio.bin` if not provided. Affects how OpenAI infers the format. */
  filename?: string;
  /** MIME type — defaults to audio/mpeg. Override for wav, m4a, etc. */
  contentType?: string;
}

export interface CallGPTNanoFallbackParams {
  system: string;
  messages: GPTChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

// ─── Singleton client ──────────────────────────────────────

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local and your deploy environment.",
    );
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

// ─── Fallback model selection ──────────────────────────────
//
// PRIMARY_FALLBACK is what selectModel returns when an org is out of
// credits. If the API responds with a model-not-found error on first
// call, we record the swap and use SECONDARY_FALLBACK for the lifetime
// of the process.
export const PRIMARY_FALLBACK_MODEL = "gpt-5-nano";
export const SECONDARY_FALLBACK_MODEL = "gpt-4o-mini";
let _effectiveFallbackModel: string = PRIMARY_FALLBACK_MODEL;
let _loggedFallbackSwap = false;

export function getEffectiveFallbackModel(): string {
  return _effectiveFallbackModel;
}

// ─── Whisper ───────────────────────────────────────────────

export async function transcribeAudio(
  params: TranscribeAudioParams,
): Promise<WhisperResponse> {
  const client = getOpenAIClient();
  const {
    audio,
    language = "en",
    prompt,
    filename = "audio.bin",
    contentType = "audio/mpeg",
  } = params;

  try {
    // The OpenAI SDK wants a `File`-like object (web File or Node Blob
    // with a name). Buffers are wrapped in a Blob so the request stays
    // a streaming multipart upload.
    let file: File | Blob;
    if (audio instanceof File) {
      file = audio;
    } else if (audio instanceof Blob) {
      file = audio;
    } else {
      file = new Blob([new Uint8Array(audio)], { type: contentType });
    }
    // Attach a filename hint so OpenAI can sniff the format.
    const fileWithName =
      file instanceof File
        ? file
        : new File([file], filename, { type: contentType });

    const response = await client.audio.transcriptions.create({
      file: fileWithName,
      model: "whisper-1",
      language,
      prompt,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    // verbose_json shape — the SDK types are wider than the actual
    // payload, so we read defensively.
    const raw = response as unknown as {
      text: string;
      duration?: number;
      segments?: { start: number; end: number; text: string }[];
    };

    return {
      success: true,
      transcript: raw.text,
      segments: raw.segments ?? [],
      duration: raw.duration ?? 0,
    };
  } catch (err) {
    console.error("[transcribeAudio] Whisper error:", err);
    return {
      success: false,
      error: friendlyMessage(err) ?? "Couldn't transcribe the audio.",
    };
  }
}

// ─── GPT chat fallback ─────────────────────────────────────

export async function callGPTNanoFallback(
  params: CallGPTNanoFallbackParams,
): Promise<GPTChatResponse> {
  const { system, messages, maxTokens = 4096, temperature = 0.7 } = params;
  const client = getOpenAIClient();

  const chatMessages: GPTChatMessage[] = [
    { role: "system", content: system },
    ...messages,
  ];

  async function tryModel(modelId: string): Promise<GPTChatResponse> {
    const response = await client.chat.completions.create({
      model: modelId,
      messages: chatMessages,
      max_tokens: maxTokens,
      temperature,
    });
    const choice = response.choices[0];
    const text = choice?.message?.content ?? "";
    const usage = response.usage ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
    };
    // OpenAI surfaces cached prompt tokens under
    // prompt_tokens_details.cached_tokens when prompt caching is in
    // effect (gpt-4o family and newer).
    const cached =
      (usage as { prompt_tokens_details?: { cached_tokens?: number } })
        .prompt_tokens_details?.cached_tokens ?? 0;
    return {
      success: true,
      response: text,
      usage: {
        input_tokens: usage.prompt_tokens ?? 0,
        output_tokens: usage.completion_tokens ?? 0,
        cached_tokens: cached,
      },
      model: response.model,
    };
  }

  try {
    return await tryModel(_effectiveFallbackModel);
  } catch (err) {
    // Model-not-found surfaces as 404 with a message like
    // "The model `gpt-5-nano` does not exist". Swap to the secondary
    // fallback once per process so we don't pay the round-trip again.
    if (
      _effectiveFallbackModel === PRIMARY_FALLBACK_MODEL &&
      isModelNotFound(err)
    ) {
      if (!_loggedFallbackSwap) {
        console.warn(
          `[callGPTNanoFallback] ${PRIMARY_FALLBACK_MODEL} unavailable — falling back to ${SECONDARY_FALLBACK_MODEL} for the lifetime of this process.`,
        );
        _loggedFallbackSwap = true;
      }
      _effectiveFallbackModel = SECONDARY_FALLBACK_MODEL;
      try {
        return await tryModel(_effectiveFallbackModel);
      } catch (err2) {
        console.error("[callGPTNanoFallback] Retry failed:", err2);
        return {
          success: false,
          error: friendlyMessage(err2) ?? "AI fallback unavailable.",
        };
      }
    }
    console.error("[callGPTNanoFallback] Error:", err);
    return {
      success: false,
      error: friendlyMessage(err) ?? "AI fallback unavailable.",
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────

function isModelNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; code?: string; message?: string };
  if (e.status === 404) return true;
  if (e.code === "model_not_found") return true;
  if (typeof e.message === "string" && /model.*(does not exist|not found)/i.test(e.message))
    return true;
  return false;
}

function friendlyMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    if (status === 401) return "OpenAI authentication failed.";
    if (status === 403) return "OpenAI refused the request.";
    if (status === 429)
      return "OpenAI is rate-limiting requests. Try again shortly.";
    if (status === 400) return "OpenAI rejected the request (bad input).";
    if (typeof status === "number" && status >= 500)
      return "OpenAI is unavailable. Try again shortly.";
  }
  if (err instanceof Error && err.message) return err.message;
  return null;
}
