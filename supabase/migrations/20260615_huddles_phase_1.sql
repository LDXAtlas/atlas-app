-- ============================================================
-- HUDDLES PHASE 1 — Meeting orchestration schema
--
-- DOCUMENTATION ONLY — schema is already live in Supabase. This file
-- mirrors what's in production so the source-controlled migration
-- record stays authoritative. Do NOT re-run.
-- ============================================================

-- ─── Huddles (one row per meeting) ──────────────────────────
CREATE TABLE public.huddles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) > 0),
  description text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  timezone text,
  meeting_source text NOT NULL DEFAULT 'in_person'
    CHECK (meeting_source IN (
      'in_person', 'external_video_link', 'uploaded_recording',
      'zoom_native', 'meet_native', 'teams_native', 'atlas_video'
    )),
  external_meeting_url text,
  external_meeting_id text,
  location text,
  department_id uuid REFERENCES public.departments ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'scheduled', 'in_progress', 'completed',
      'processing', 'ready', 'archived'
    )),
  visibility text NOT NULL DEFAULT 'invitees_only'
    CHECK (visibility IN ('organization', 'department', 'invitees_only', 'private')),
  recording_retention_days integer,
  recording_pinned boolean DEFAULT false,
  recording_deleted_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_huddles_org_time ON public.huddles (organization_id, scheduled_start DESC);
CREATE INDEX idx_huddles_status ON public.huddles (organization_id, status);

-- ─── Attendees (profile_id XOR member_id supports invited
-- people who don't have app accounts yet) ─────────────────
CREATE TABLE public.huddle_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  member_id uuid,
  role text DEFAULT 'attendee'
    CHECK (role IN ('organizer', 'presenter', 'attendee', 'optional')),
  attended boolean DEFAULT false,
  attended_at timestamptz,
  invited_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendee_subject_xor
    CHECK ((profile_id IS NOT NULL) <> (member_id IS NOT NULL))
);

CREATE INDEX idx_huddle_attendees_huddle ON public.huddle_attendees (huddle_id);
CREATE INDEX idx_huddle_attendees_profile ON public.huddle_attendees (profile_id) WHERE profile_id IS NOT NULL;

-- ─── Agenda items ───────────────────────────────────────────
CREATE TABLE public.huddle_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) > 0),
  description text,
  estimated_minutes integer,
  presenter_id uuid REFERENCES public.profiles ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  is_completed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_huddle_agenda_huddle ON public.huddle_agenda_items (huddle_id, position);

-- ─── Notes (one row per huddle) ─────────────────────────────
CREATE TABLE public.huddle_notes (
  huddle_id uuid PRIMARY KEY REFERENCES public.huddles ON DELETE CASCADE,
  content text DEFAULT '',
  last_edited_by uuid REFERENCES public.profiles ON DELETE SET NULL,
  last_edited_at timestamptz DEFAULT now()
);

-- ─── Decisions ──────────────────────────────────────────────
CREATE TABLE public.huddle_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles ON DELETE CASCADE,
  decision text NOT NULL CHECK (length(decision) > 0),
  context text,
  decided_by uuid REFERENCES public.profiles ON DELETE SET NULL,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'ai_extracted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_huddle_decisions_huddle ON public.huddle_decisions (huddle_id);

-- ─── Action items ───────────────────────────────────────────
-- task_id is set when promoteActionItemToTask creates a real task row.
CREATE TABLE public.huddle_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks ON DELETE SET NULL,
  description text NOT NULL CHECK (length(description) > 0),
  suggested_assignee_id uuid REFERENCES public.profiles ON DELETE SET NULL,
  suggested_due_date timestamptz,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'ai_extracted')),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_huddle_action_items_huddle ON public.huddle_action_items (huddle_id);
CREATE INDEX idx_huddle_action_items_task ON public.huddle_action_items (task_id) WHERE task_id IS NOT NULL;

-- ─── Recording / transcript / summary tables (Phase 2 fills) ─
CREATE TABLE public.huddle_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles ON DELETE CASCADE,
  storage_path text NOT NULL,
  duration_seconds integer,
  size_bytes bigint,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.huddle_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles ON DELETE CASCADE,
  content text,
  segments jsonb,
  language text,
  word_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.huddle_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles ON DELETE CASCADE,
  summary text,
  key_points jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Tasks: source columns ──────────────────────────────────
-- DOC NOTE: tasks.source defaults to 'manual'; promoteActionItemToTask
-- writes 'huddle' + source_huddle_id. Existing createTask paths are
-- unchanged.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'huddle', 'announcement', 'imported')),
  ADD COLUMN IF NOT EXISTS source_huddle_id uuid REFERENCES public.huddles ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_source_huddle ON public.tasks (source_huddle_id)
  WHERE source_huddle_id IS NOT NULL;

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE public.huddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view huddles they have access to"
  ON public.huddles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      visibility = 'organization'
      OR created_by = auth.uid()
      OR id IN (SELECT huddle_id FROM public.huddle_attendees WHERE profile_id = auth.uid())
      OR (visibility = 'department' AND department_id IN (
        SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Authorized roles can create huddles"
  ON public.huddles FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff', 'leader')
    )
  );

CREATE POLICY "Organizer or admin can update huddles"
  ON public.huddles FOR UPDATE
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Organizer or admin can delete huddles"
  ON public.huddles FOR DELETE
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Child tables inherit access via huddle_id IN (SELECT id FROM public.huddles)
-- This relies on the parent policy above to enforce org/visibility scoping.
CREATE POLICY "Access child rows for accessible huddles"
  ON public.huddle_attendees FOR ALL
  USING (huddle_id IN (SELECT id FROM public.huddles));

CREATE POLICY "Access child rows for accessible huddles"
  ON public.huddle_agenda_items FOR ALL
  USING (huddle_id IN (SELECT id FROM public.huddles));

CREATE POLICY "Access child rows for accessible huddles"
  ON public.huddle_notes FOR ALL
  USING (huddle_id IN (SELECT id FROM public.huddles));

CREATE POLICY "Access child rows for accessible huddles"
  ON public.huddle_decisions FOR ALL
  USING (huddle_id IN (SELECT id FROM public.huddles));

CREATE POLICY "Access child rows for accessible huddles"
  ON public.huddle_action_items FOR ALL
  USING (huddle_id IN (SELECT id FROM public.huddles));

CREATE POLICY "Access child rows for accessible huddles"
  ON public.huddle_recordings FOR ALL
  USING (huddle_id IN (SELECT id FROM public.huddles));

CREATE POLICY "Access child rows for accessible huddles"
  ON public.huddle_transcripts FOR ALL
  USING (huddle_id IN (SELECT id FROM public.huddles));

CREATE POLICY "Access child rows for accessible huddles"
  ON public.huddle_summaries FOR ALL
  USING (huddle_id IN (SELECT id FROM public.huddles));
