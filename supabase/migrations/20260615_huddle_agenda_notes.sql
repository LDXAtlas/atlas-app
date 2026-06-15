-- ============================================================
-- HUDDLES — per-agenda-item notes
--
-- DOCUMENTATION ONLY. The matching ALTER below should be run in
-- Supabase by hand before relying on the per-item notes UI. Until
-- then, the page degrades gracefully:
--
--   - getHuddle's notes hydrator catches 42703 (undefined_column) and
--     returns null notes everywhere.
--   - updateAgendaItemNotes returns SCHEMA_MISSING with a clear
--     message that the UI surfaces inline.
-- ============================================================

ALTER TABLE public.huddle_agenda_items
  ADD COLUMN IF NOT EXISTS notes text;
