-- Board Stars: per-user favoriting for project boards.
-- Each row marks a single user starring a single board. The composite
-- primary key enforces uniqueness; ON DELETE CASCADE on both foreign
-- keys keeps the table self-cleaning when a user or board is removed.

CREATE TABLE public.board_stars (
  user_id    uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  board_id   uuid NOT NULL REFERENCES public.boards ON DELETE CASCADE,
  starred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board_id)
);

CREATE INDEX idx_board_stars_user  ON public.board_stars (user_id);
CREATE INDEX idx_board_stars_board ON public.board_stars (board_id);

-- Row Level Security: stars are private to the user who created them.
-- Anyone can manage their own row; no one else can read or write it.
ALTER TABLE public.board_stars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stars"
  ON public.board_stars FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own stars"
  ON public.board_stars FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own stars"
  ON public.board_stars FOR DELETE
  USING (user_id = auth.uid());
