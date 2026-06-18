-- ============================================================
-- AI CONTROL CENTER — organization_ai_settings
--
-- DOCUMENTATION ONLY — already applied to Supabase. This file mirrors
-- the live schema so the source-controlled record stays authoritative.
-- Do NOT re-run.
--
-- One row per org. Drives every AI call through the central callAI()
-- wrapper: guidelines compose into the cached portion of the system
-- prompt, model_preference is applied tier-bound by model-selector,
-- ai_enabled is the master switch.
-- ============================================================

CREATE TABLE public.organization_ai_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations ON DELETE CASCADE,

  -- Guidelines (additive customization — base Atlas rules always win).
  -- App-level char limits enforced server-side in the update action so
  -- this column type doesn't need length constraints.
  voice_tone text,
  terminology text,
  about_church text,
  things_to_avoid text,
  additional_guidelines text,

  -- Tier-bounded preference. Model-selector translates this into a
  -- concrete model within tier limits — never let an org exceed its
  -- tier's cost ceiling.
  model_preference text NOT NULL DEFAULT 'balanced'
    CHECK (model_preference IN ('speed', 'balanced', 'quality')),

  -- Master switch. When false, callAI short-circuits gracefully.
  ai_enabled boolean NOT NULL DEFAULT true,

  updated_by uuid REFERENCES public.profiles ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_ai_settings ENABLE ROW LEVEL SECURITY;

-- Org members can READ their org's settings (e.g., to show the page in
-- read-only mode for non-admins). Writes are admin-gated server-side
-- via the service-role client — no INSERT/UPDATE/DELETE policies here
-- since application code uses supabaseAdmin and re-enforces the role
-- check in the server action.
CREATE POLICY "Org members can read their AI settings"
  ON public.organization_ai_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );
