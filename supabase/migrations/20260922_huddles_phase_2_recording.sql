-- ============================================================
-- HUDDLES PHASE 2 (part 1) — Recording, storage, transcription
--
-- APPLIED to the live database on 2026-09-22. This file is the
-- source-controlled record of that change; every statement is
-- re-runnable, but there is no need to run it again.
--
-- Written against the LIVE schema (supabase/LIVE_SCHEMA_2026-09-22.md
-- plus the constraint / index / trigger / policy dump of the same
-- date), NOT against 20260615_huddles_phase_1.sql, which does not
-- describe the live huddle tables. A first draft written from that file
-- failed on apply ("recording_id already exists") and rolled back.
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- named constraints guarded by existence checks, CREATE OR REPLACE for
-- functions, DROP ... IF EXISTS before re-creating triggers, policies
-- and CHECKs, and ON CONFLICT for the bucket.
--
-- Everything is additive except section 7, which deliberately narrows
-- RLS on huddle_transcripts / huddle_recordings, and section 4, which
-- changes one FK's delete rule.
--
-- Contents:
--   1. Private storage bucket "huddle-recordings"
--   2. huddle_recordings: one row per recorded segment
--   3. huddle_transcripts: one row per segment (existing recording_id)
--   4. huddle_summaries: source_transcript_ids; transcript_id FK → SET NULL
--   5. huddles: recording state for the consent indicator
--   6. Functions: org id + retention default trigger, retention
--      recompute, storage counter
--   7. RLS: transcripts + recordings readable by organizer / org admin only
--   8. notifications CHECKs: new huddle types + 'huddle' entity type
-- ============================================================

BEGIN;

-- Safety: several segment columns below are NOT NULL with no default,
-- which is only valid on empty tables. Live counts were 0 on 2026-09-22.
-- The check only applies before this migration has run (segment_index
-- absent), so a re-run after real recordings exist is still safe.
DO $$
BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'huddle_recordings'
          AND column_name = 'segment_index')
     AND (EXISTS (SELECT 1 FROM public.huddle_recordings)
          OR EXISTS (SELECT 1 FROM public.huddle_transcripts)) THEN
    RAISE EXCEPTION 'huddle_recordings / huddle_transcripts are not empty — stop and review this migration';
  END IF;
END $$;

-- ─── 1. Storage bucket ──────────────────────────────────────
-- Private. No storage.objects policies are created, so only the service
-- role (server actions) and short-lived signed upload URLs can touch
-- objects. Object path: <org_id>/<huddle_id>/<recording_id>.<ext>.
-- 25 MB matches Whisper's per-file limit; the recorder rolls segments
-- at ~20 MB. Uploads set the base MIME type (no ;codecs= parameter).
-- The recorder probes MediaRecorder.isTypeSupported in this order and
-- uses the first hit:
--   audio/webm;codecs=opus, audio/webm, audio/mp4 (Safari),
--   audio/ogg;codecs=opus, audio/ogg (Firefox)
-- No huddle bucket existed live on 2026-09-22. ON CONFLICT re-asserts
-- the settings on a re-run.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'huddle-recordings',
  'huddle-recordings',
  false,
  26214400,
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 2. huddle_recordings → segments ────────────────────────
-- Live columns reused as-is:
--   storage_path      <org_id>/<huddle_id>/<recording_id>.<ext>
--   file_type         the MIME type MediaRecorder actually used, in full
--                     (e.g. 'audio/webm;codecs=opus'). There is no
--                     mime_type column.
--   size_bytes        real object size, read from storage on confirm
--   duration_seconds  wall-clock segment length
--   source_type       'browser_recording' for the in-app recorder;
--                     'uploaded_file' for part 3 uploads (live CHECK
--                     also allows zoom_api_import / meet_api_import /
--                     atlas_native)
--   uploaded_by / uploaded_at
--   deleted_at        LEFT UNUSED. Delete means delete (hard delete of
--                     object + rows); nothing sets or reads this column.
-- Added:
--   organization_id   denormalized from the parent huddle; filled +
--                     checked by the BEFORE INSERT trigger (section 6).
--   segment_index     assigned server-side, increasing per huddle across
--                     pause/resume and separate recording sessions.
--   started_at /      wall-clock bounds of the segment.
--   ended_at
--   audio_bits_per_second  what MediaRecorder actually reported.
--   upload_status     pending_upload → uploaded | upload_failed.
--   transcription_*   claim-and-retry state for the transcribe route.
--                     'awaiting_credits' = parked because the org ran out
--                     of AI credits; retryable after a reset/top-up.
--   retention_until   defaulted by the trigger from the huddle / org
--                     setting.
ALTER TABLE public.huddle_recordings
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
    REFERENCES public.organizations ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS segment_index integer NOT NULL
    CHECK (segment_index >= 0),
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz NOT NULL,
  ADD COLUMN IF NOT EXISTS audio_bits_per_second integer,
  ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'pending_upload'
    CHECK (upload_status IN ('pending_upload', 'uploaded', 'upload_failed')),
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'pending'
    CHECK (transcription_status IN (
      'pending', 'processing', 'done', 'failed', 'awaiting_credits'
    )),
  ADD COLUMN IF NOT EXISTS transcription_error text,
  ADD COLUMN IF NOT EXISTS transcription_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transcription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'huddle_recordings_segment_times'
                    AND conrelid = 'public.huddle_recordings'::regclass) THEN
    ALTER TABLE public.huddle_recordings
      ADD CONSTRAINT huddle_recordings_segment_times CHECK (ended_at >= started_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'huddle_recordings_segment_unique'
                    AND conrelid = 'public.huddle_recordings'::regclass) THEN
    ALTER TABLE public.huddle_recordings
      ADD CONSTRAINT huddle_recordings_segment_unique UNIQUE (huddle_id, segment_index);
  END IF;
END $$;

-- The part 3 purge scans by retention_until across all orgs.
-- (idx_huddle_recordings_huddle on huddle_id already exists live.)
CREATE INDEX IF NOT EXISTS idx_huddle_recordings_retention
  ON public.huddle_recordings (retention_until);

-- ─── 3. huddle_transcripts → one per segment ────────────────
-- Live columns reused: full_text (NOT NULL — the transcript text; there
-- is no content column), segments, language (default 'en'), model_used,
-- recording_id. The live FK huddle_transcripts_recording_id_fkey is
-- already ON DELETE CASCADE, so deleting a recording row removes its
-- transcript; delete actions also remove transcripts explicitly.
-- Here: recording_id becomes NOT NULL (table is empty) and UNIQUE.
ALTER TABLE public.huddle_transcripts
  ALTER COLUMN recording_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'huddle_transcripts_recording_unique'
                    AND conrelid = 'public.huddle_transcripts'::regclass) THEN
    ALTER TABLE public.huddle_transcripts
      ADD CONSTRAINT huddle_transcripts_recording_unique UNIQUE (recording_id);
  END IF;
END $$;

-- Already exists live; kept so a fresh environment gets it too.
CREATE INDEX IF NOT EXISTS idx_huddle_transcripts_huddle
  ON public.huddle_transcripts (huddle_id);

-- ─── 4. huddle_summaries ────────────────────────────────────
-- source_transcript_ids: provenance for the part 2 summary, which spans
-- many segment transcripts. Deliberately no FK: a summary must survive
-- deletion of the recording + transcripts it was built from.
ALTER TABLE public.huddle_summaries
  ADD COLUMN IF NOT EXISTS source_transcript_ids uuid[];

-- transcript_id exists live with ON DELETE CASCADE, which would delete a
-- summary when its transcript is deleted. Change it to SET NULL so the
-- summary survives. The column itself stays unused.
ALTER TABLE public.huddle_summaries
  DROP CONSTRAINT IF EXISTS huddle_summaries_transcript_id_fkey,
  ADD CONSTRAINT huddle_summaries_transcript_id_fkey
    FOREIGN KEY (transcript_id) REFERENCES public.huddle_transcripts (id)
    ON DELETE SET NULL;

-- ─── 5. huddles: recording state (consent indicator) ────────
-- "Live" = recording_state <> 'idle' AND recording_heartbeat_at within
-- the last 90 s (the recorder heartbeats every 30 s). A crashed tab
-- leaves a stale heartbeat, so the indicator clears on its own.
ALTER TABLE public.huddles
  ADD COLUMN IF NOT EXISTS recording_state text NOT NULL DEFAULT 'idle'
    CHECK (recording_state IN ('idle', 'recording', 'paused')),
  ADD COLUMN IF NOT EXISTS recording_state_by uuid
    REFERENCES public.profiles ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recording_heartbeat_at timestamptz;

-- ─── 6. Functions ───────────────────────────────────────────

-- 6a. BEFORE INSERT on huddle_recordings: take organization_id from the
-- parent huddle (reject a mismatch) and default retention_until to
-- started_at + (huddle.recording_retention_days
--               ?? organizations.default_recording_retention_days ?? 30).
-- Note: live huddles.recording_retention_days has DEFAULT 30, so new
-- huddles carry 30 explicitly and the org default only applies where the
-- huddle value is NULL.
CREATE OR REPLACE FUNCTION public.huddle_recordings_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org uuid;
  v_days integer;
BEGIN
  SELECT h.organization_id,
         COALESCE(h.recording_retention_days, o.default_recording_retention_days, 30)
    INTO v_org, v_days
    FROM public.huddles h
    JOIN public.organizations o ON o.id = h.organization_id
   WHERE h.id = NEW.huddle_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'huddle % not found', NEW.huddle_id;
  END IF;
  IF NEW.organization_id IS NOT NULL AND NEW.organization_id <> v_org THEN
    RAISE EXCEPTION 'organization_id does not match the huddle''s organization';
  END IF;
  NEW.organization_id := v_org;

  IF NEW.retention_until IS NULL THEN
    NEW.retention_until := NEW.started_at + make_interval(days => v_days);
  END IF;
  RETURN NEW;
END;
$$;

-- No user-defined triggers existed on any huddle table on 2026-09-22.
DROP TRIGGER IF EXISTS trg_huddle_recordings_before_insert ON public.huddle_recordings;
CREATE TRIGGER trg_huddle_recordings_before_insert
  BEFORE INSERT ON public.huddle_recordings
  FOR EACH ROW EXECUTE FUNCTION public.huddle_recordings_before_insert();

-- 6b. Recompute retention_until for a huddle's segments. Called by
-- updateHuddleSettings when recording_retention_days changes (PostgREST
-- can't express the per-row arithmetic). The part 3 purge must also
-- recompute rather than trust a stored value.
CREATE OR REPLACE FUNCTION public.recompute_huddle_recording_retention(p_huddle_id uuid)
RETURNS integer
LANGUAGE sql
SET search_path = public, pg_catalog
AS $$
  WITH updated AS (
    UPDATE public.huddle_recordings r
       SET retention_until = r.started_at + make_interval(days =>
             COALESCE(h.recording_retention_days, o.default_recording_retention_days, 30))
      FROM public.huddles h
      JOIN public.organizations o ON o.id = h.organization_id
     WHERE r.huddle_id = p_huddle_id
       AND h.id = r.huddle_id
    RETURNING 1
  )
  SELECT count(*)::integer FROM updated;
$$;

-- 6c. Atomic adjustment of organizations.huddle_storage_used_bytes
-- (+size on confirmed upload, -size on delete). Clamped at 0. Replaces
-- the read-modify-write pattern the Library uses, which can lose
-- concurrent updates.
CREATE OR REPLACE FUNCTION public.adjust_huddle_storage_used(
  p_organization_id uuid,
  p_delta_bytes bigint
)
RETURNS bigint
LANGUAGE sql
SET search_path = public, pg_catalog
AS $$
  UPDATE public.organizations
     SET huddle_storage_used_bytes =
           GREATEST(0, COALESCE(huddle_storage_used_bytes, 0) + p_delta_bytes)
   WHERE id = p_organization_id
  RETURNING huddle_storage_used_bytes;
$$;

-- Server-only: the app calls these with the service-role client.
-- Signed-in users must not be able to call them through PostgREST.
REVOKE EXECUTE ON FUNCTION public.recompute_huddle_recording_retention(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_huddle_storage_used(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_huddle_recording_retention(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_huddle_storage_used(uuid, bigint) TO service_role;

-- ─── 7. RLS: transcripts + recordings, organizer / org admin only ──
-- NOT additive. Live, every huddle child table has a cmd=ALL policy for
-- any huddle viewer, which would let any viewer read transcript text —
-- and insert/update/delete rows — directly through PostgREST with their
-- own session. Reversed for these two tables 2026-09-22, before any data
-- existed. (The other child tables have the same problem; see
-- BACKEND_NOTES → PENDING, security audit.)
--
-- Policy names: the Phase 1 migration file records these as "Access
-- child rows for accessible huddles", but the live database names them
-- "Access huddle transcripts via huddle access" / "Access huddle
-- recordings via huddle access" (read from pg_policies 2026-09-22). The
-- DROPs below use the live names.
--
-- Replacement: SELECT only, for the huddle's creator or an org admin who
-- can see the huddle (the subquery on huddles is itself subject to the
-- huddles SELECT policy — same rule as canManage in the app). No
-- INSERT / UPDATE / DELETE policies: all writes go through the
-- service-role client in server actions.
DROP POLICY IF EXISTS "Access huddle transcripts via huddle access" ON public.huddle_transcripts;
DROP POLICY IF EXISTS "Access huddle recordings via huddle access" ON public.huddle_recordings;
DROP POLICY IF EXISTS "Organizer or admin can read transcripts" ON public.huddle_transcripts;
DROP POLICY IF EXISTS "Organizer or admin can read recordings" ON public.huddle_recordings;

CREATE POLICY "Organizer or admin can read transcripts"
  ON public.huddle_transcripts FOR SELECT
  USING (
    huddle_id IN (
      SELECT h.id FROM public.huddles h
      WHERE h.created_by = auth.uid()
         OR h.organization_id IN (
              SELECT p.organization_id FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role = 'admin'
            )
    )
  );

CREATE POLICY "Organizer or admin can read recordings"
  ON public.huddle_recordings FOR SELECT
  USING (
    huddle_id IN (
      SELECT h.id FROM public.huddles h
      WHERE h.created_by = auth.uid()
         OR h.organization_id IN (
              SELECT p.organization_id FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role = 'admin'
            )
    )
  );

-- ─── 8. notifications CHECK constraints ─────────────────────
-- Base lists are the LIVE constraints as read on 2026-09-22 (not the
-- 20260512 migration file). Adds the three huddle types (none wired up
-- yet — 'huddle_crisis_flag' deliberately unused) and the 'huddle'
-- entity type.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check,
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'task_assigned',
    'task_comment',
    'task_due_soon',
    'announcement_posted',
    'announcement_mention',
    'event_invited',
    'event_reminder',
    'board_member_added',
    'board_card_assigned',
    'board_card_comment',
    'board_card_mention',
    'team_member_invited',
    'team_member_joined',
    'department_assigned',
    'mention',
    'system',
    'huddle_invited',
    'huddle_action_assigned',
    'huddle_crisis_flag'
  ));

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_entity_type_check,
  ADD CONSTRAINT notifications_entity_type_check CHECK (entity_type IN (
    'task',
    'announcement',
    'event',
    'board',
    'board_card',
    'profile',
    'department',
    'organization',
    'huddle'
  ));

COMMIT;
