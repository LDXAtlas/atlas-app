-- ============================================================
-- PROJECT BOARDS SCHEMA
-- ============================================================
--
-- NOTE: This file is documentation only. The schema is already live in
-- Supabase from SQL run earlier; do not re-apply this migration against
-- a database that already has these tables.

-- Boards table
CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#5CE1A5',
  icon text DEFAULT 'Folder',
  department_id uuid REFERENCES public.departments ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'organization' CHECK (visibility IN ('organization', 'department', 'private', 'invitees_only')),
  is_archived boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_boards_organization_id ON public.boards (organization_id);
CREATE INDEX idx_boards_department ON public.boards (department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_boards_archived ON public.boards (organization_id, is_archived);

-- Board columns (the lanes within a board)
CREATE TABLE public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#9CA3AF',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_columns_board ON public.board_columns (board_id, position);

-- Board cards (the items within columns)
CREATE TABLE public.board_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.board_columns ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_color text,
  due_date timestamptz,
  assigned_to uuid REFERENCES public.profiles ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_cards_board ON public.board_cards (board_id);
CREATE INDEX idx_board_cards_column ON public.board_cards (column_id, position);
CREATE INDEX idx_board_cards_assigned ON public.board_cards (assigned_to) WHERE assigned_to IS NOT NULL;

-- Card labels (tags)
CREATE TABLE public.card_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#5CE1A5',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, name)
);

CREATE INDEX idx_card_labels_board ON public.card_labels (board_id);

-- Card-label junction
CREATE TABLE public.board_card_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.board_cards ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.card_labels ON DELETE CASCADE,
  UNIQUE(card_id, label_id)
);

CREATE INDEX idx_board_card_labels_card ON public.board_card_labels (card_id);

-- Card checklist items (sub-tasks on a card)
CREATE TABLE public.card_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.board_cards ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_card ON public.card_checklist_items (card_id, position);

-- Card comments
CREATE TABLE public.card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.board_cards ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_comments_card ON public.card_comments (card_id, created_at DESC);

-- Board members
CREATE TABLE public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'editor', 'member', 'viewer')),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, profile_id)
);

CREATE INDEX idx_board_members_board ON public.board_members (board_id);
CREATE INDEX idx_board_members_profile ON public.board_members (profile_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- Boards: visible based on visibility rules
CREATE POLICY "Users can view accessible boards"
  ON public.boards FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
    AND (
      visibility = 'organization'
      OR created_by = auth.uid()
      OR id IN (SELECT board_id FROM public.board_members WHERE profile_id = auth.uid())
    )
  );

CREATE POLICY "Admin and staff can create boards"
  ON public.boards FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role IN ('admin', 'staff', 'leader')
    )
  );

CREATE POLICY "Creators and admins can update boards"
  ON public.boards FOR UPDATE
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role = 'admin'
    )
    OR id IN (
      SELECT board_id FROM public.board_members
      WHERE profile_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Creators and admins can delete boards"
  ON public.boards FOR DELETE
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role = 'admin'
    )
  );

-- Columns: same access as parent board
CREATE POLICY "Users can view columns on accessible boards"
  ON public.board_columns FOR SELECT
  USING (board_id IN (SELECT id FROM public.boards));

CREATE POLICY "Editors can manage columns"
  ON public.board_columns FOR ALL
  USING (
    board_id IN (
      SELECT id FROM public.boards
      WHERE created_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND role IN ('admin', 'staff', 'leader')
      )
    )
  );

-- Cards: same access as parent board
CREATE POLICY "Users can view cards on accessible boards"
  ON public.board_cards FOR SELECT
  USING (board_id IN (SELECT id FROM public.boards));

CREATE POLICY "Authorized users can manage cards"
  ON public.board_cards FOR ALL
  USING (
    board_id IN (
      SELECT id FROM public.boards
      WHERE created_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND role IN ('admin', 'staff', 'leader')
      )
    )
  );

-- Labels: board-scoped
CREATE POLICY "Users can view labels on accessible boards"
  ON public.card_labels FOR SELECT
  USING (board_id IN (SELECT id FROM public.boards));

CREATE POLICY "Authorized users can manage labels"
  ON public.card_labels FOR ALL
  USING (
    board_id IN (
      SELECT id FROM public.boards
      WHERE created_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND role IN ('admin', 'staff', 'leader')
      )
    )
  );

-- Card-label junction
CREATE POLICY "Users can view card labels"
  ON public.board_card_labels FOR SELECT
  USING (card_id IN (SELECT id FROM public.board_cards));

CREATE POLICY "Authorized users can manage card labels"
  ON public.board_card_labels FOR ALL
  USING (
    card_id IN (
      SELECT id FROM public.board_cards
      WHERE board_id IN (
        SELECT id FROM public.boards
        WHERE created_by = auth.uid()
        OR organization_id IN (
          SELECT organization_id FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND role IN ('admin', 'staff', 'leader')
        )
      )
    )
  );

-- Checklist items
CREATE POLICY "Users can view checklist items"
  ON public.card_checklist_items FOR SELECT
  USING (card_id IN (SELECT id FROM public.board_cards));

CREATE POLICY "Authorized users can manage checklist items"
  ON public.card_checklist_items FOR ALL
  USING (
    card_id IN (
      SELECT id FROM public.board_cards
      WHERE board_id IN (
        SELECT id FROM public.boards
        WHERE created_by = auth.uid()
        OR organization_id IN (
          SELECT organization_id FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND role IN ('admin', 'staff', 'leader')
        )
      )
    )
  );

-- Comments
CREATE POLICY "Users can view comments on accessible cards"
  ON public.card_comments FOR SELECT
  USING (card_id IN (SELECT id FROM public.board_cards));

CREATE POLICY "Users can add comments on accessible cards"
  ON public.card_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND card_id IN (SELECT id FROM public.board_cards)
  );

CREATE POLICY "Authors can update their own comments"
  ON public.card_comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Authors and admins can delete comments"
  ON public.card_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Board members
CREATE POLICY "Users can view board memberships on accessible boards"
  ON public.board_members FOR SELECT
  USING (board_id IN (SELECT id FROM public.boards));

CREATE POLICY "Board owners and admins can manage members"
  ON public.board_members FOR ALL
  USING (
    board_id IN (
      SELECT id FROM public.boards
      WHERE created_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND role = 'admin'
      )
    )
  );
