-- ============================================================
-- HUDDLES PHASE 0 — AI Infrastructure
--
-- DOCUMENTATION ONLY — schema and helpers are already live in Supabase.
-- This file mirrors what's in production so the source-controlled
-- migration record stays authoritative. Do NOT re-run.
--
-- Live state:
--   organizations table gained these columns in earlier infra work:
--     ai_credits_limit            integer
--     ai_credits_used             integer
--     ai_credits_reset_at         timestamptz
--     huddle_storage_limit_bytes  bigint
--     huddle_storage_used_bytes   bigint
--     default_recording_retention_days  integer  default 30
--
--   PostgreSQL helper functions:
--     get_ai_credits_remaining(p_organization_id uuid) returns integer
--     consume_ai_credits(p_organization_id uuid, p_credits_to_consume integer) returns integer
--
--   ai_usage_log table (per-call audit trail)
-- ============================================================

CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles ON DELETE SET NULL,
  feature text NOT NULL CHECK (feature IN (
    'huddle_transcription',
    'huddle_summary',
    'huddle_action_extraction',
    'atlas_ai_chat',
    'announcement_generation',
    'sermon_prep',
    'care_followup',
    'smart_suggestion',
    'other'
  )),
  provider text NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model text NOT NULL,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cached_input_tokens integer DEFAULT 0,
  audio_seconds integer DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  cost_usd_estimated numeric(10, 6) DEFAULT 0,
  was_fallback boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_org_time ON public.ai_usage_log (organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_feature ON public.ai_usage_log (feature, created_at DESC);
CREATE INDEX idx_ai_usage_log_user ON public.ai_usage_log (user_id, created_at DESC) WHERE user_id IS NOT NULL;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's AI usage"
  ON public.ai_usage_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
  );

-- INSERTs are made server-side via the service-role client (it bypasses
-- RLS), so no INSERT policy is needed for normal app traffic. We add one
-- anyway so admins can backfill from the SQL editor without ALTERing RLS.
CREATE POLICY "Service role and admins can insert AI usage"
  ON public.ai_usage_log FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role = 'admin'
    )
  );

-- ─── PostgreSQL helpers (already live) ──────────────────────
--
-- get_ai_credits_remaining returns ai_credits_limit - ai_credits_used,
-- clamped at 0.
--
-- consume_ai_credits increments ai_credits_used atomically and returns
-- the new remaining balance. Used by the Phase 0 callAI wrapper.
-- ============================================================
