-- ============================================================
-- Card activity log (Project Boards Phase 3)
--
-- Every "interesting" thing that happens on a board card writes one row
-- here: title/description changes, column moves, assignments, label add/
-- remove, checklist creation+completion, comments, attachments, completion.
-- The detail panel reads the latest 20 per card.
--
-- Insert path is best-effort — board actions log and continue when this
-- fails (we never roll back the primary write because activity broke).
-- ============================================================

CREATE TABLE public.card_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.board_cards ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'created', 'title_changed', 'description_changed', 'moved_column',
    'assigned', 'unassigned', 'due_date_changed', 'label_added', 'label_removed',
    'checklist_added', 'checklist_completed', 'checklist_removed',
    'comment_added', 'attachment_added', 'attachment_removed',
    'completed', 'reopened'
  )),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_activity_card ON public.card_activity (card_id, created_at DESC);

ALTER TABLE public.card_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view card activity in their org"
  ON public.card_activity FOR SELECT
  USING (
    card_id IN (
      SELECT id FROM public.board_cards
      WHERE board_id IN (
        SELECT id FROM public.boards
        WHERE organization_id IN (
          SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Authorized users can create activity entries"
  ON public.card_activity FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND card_id IN (SELECT id FROM public.board_cards)
  );

-- Track when a checklist item was completed so the activity log can render
-- "Lucas checked off X on Tue" instead of just "X is done".
ALTER TABLE public.card_checklist_items
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
