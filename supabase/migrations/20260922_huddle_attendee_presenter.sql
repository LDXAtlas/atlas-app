-- ============================================================
-- HUDDLES — allow the 'presenter' attendee role
--
-- RUN THIS ONCE in the Supabase SQL editor. Independent of the Phase 2
-- recording migration; nothing in Phase 2 part 1 depends on it.
--
-- The app has always offered Presenter in the attendee role dropdown
-- (huddles/_components/attendee-list.tsx) and AttendeeRole includes it,
-- but the live CHECK only allows organizer / attendee / optional, so
-- setting someone to Presenter fails. Widening the CHECK is additive —
-- no existing row can hold 'presenter' today — and avoids editing the
-- huddles UI.
--
-- Note: this is the meeting-level role. An agenda item's presenter is a
-- different thing (huddle_agenda_items.presenter_id).
--
-- Re-runnable: drops the constraint by its live name if present, then
-- re-adds it.
-- ============================================================

BEGIN;

ALTER TABLE public.huddle_attendees
  DROP CONSTRAINT IF EXISTS huddle_attendees_role_check,
  ADD CONSTRAINT huddle_attendees_role_check CHECK (role IN (
    'organizer',
    'presenter',
    'attendee',
    'optional'
  ));

COMMIT;
