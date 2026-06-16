-- ============================================================
-- AI INFRASTRUCTURE — Monthly credit reset cron
--
-- DOCUMENTATION ONLY — already live in Supabase. This file mirrors
-- what's in production so the source-controlled record stays
-- authoritative. Do NOT re-run.
--
-- The job runs daily at 00:05 UTC via pg_cron. Each tick processes
-- every organization whose ai_credits_reset_at has passed:
--   - ai_credits_used resets to 0
--   - ai_credits_reset_at rolls forward one calendar month
--
-- SECURITY DEFINER lets the cron-owned role mutate organizations on
-- behalf of every tenant without leaning on RLS. search_path is
-- pinned per the security advisor's mutable-search-path rule, and
-- EXECUTE is revoked from PUBLIC / anon / authenticated so application
-- code can't call the reset by accident — only the cron job runner
-- inside pg_cron / postgres has access.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_monthly_ai_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.organizations
  SET
    ai_credits_used = 0,
    -- Roll the reset date forward one calendar month from the prior
    -- anchor so monthly cadence stays stable across leap days.
    ai_credits_reset_at = ai_credits_reset_at + interval '1 month'
  WHERE ai_credits_reset_at IS NOT NULL
    AND now() >= ai_credits_reset_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_monthly_ai_credits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_ai_credits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_ai_credits() FROM authenticated;

-- ─── Schedule (pg_cron extension) ───────────────────────────
--
-- '5 0 * * *' = 00:05 UTC daily. The 5-minute offset keeps the job
-- off the round-hour rush and gives any midnight billing jobs room
-- to settle before we touch credit counters.
--
-- If you ever need to inspect or unschedule the job:
--   SELECT * FROM cron.job WHERE jobname = 'reset-monthly-ai-credits';
--   SELECT cron.unschedule('reset-monthly-ai-credits');
SELECT cron.schedule(
  'reset-monthly-ai-credits',
  '5 0 * * *',
  $$SELECT public.reset_monthly_ai_credits();$$
);
