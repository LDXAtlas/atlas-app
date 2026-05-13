-- ============================================================
-- LIBRARY PHASE 3 — Standalone Library Page Schema
--
-- DOCUMENTATION ONLY — this SQL has already been applied directly to
-- Supabase. This file exists so the source-controlled schema record
-- stays the authority for "what's live." Do NOT re-run.
--
-- Companion change (also applied in Supabase, separately):
--   ALTER TABLE public.attachments ALTER COLUMN entity_id DROP NOT NULL;
-- Lets direct-library uploads use entity_type='library' + entity_id IS NULL
-- instead of a sentinel UUID. The Phase 1 access-check branches on null
-- to skip the parent-entity lookup and rely on org + folder-visibility
-- rules instead.
-- ============================================================

-- Library folders (hierarchical structure)
CREATE TABLE public.library_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  parent_folder_id uuid REFERENCES public.library_folders ON DELETE CASCADE,
  description text,
  color text DEFAULT '#6B7280',
  icon text DEFAULT 'Folder',
  visibility text NOT NULL DEFAULT 'organization' CHECK (visibility IN ('organization', 'department', 'private')),
  department_id uuid REFERENCES public.departments ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT name_not_empty CHECK (length(name) > 0)
);

CREATE INDEX idx_library_folders_org ON public.library_folders (organization_id);
CREATE INDEX idx_library_folders_parent ON public.library_folders (parent_folder_id);
CREATE INDEX idx_library_folders_dept ON public.library_folders (department_id) WHERE department_id IS NOT NULL;

-- Library tags
CREATE TABLE public.library_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6B7280',
  created_by uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name),
  CONSTRAINT tag_name_not_empty CHECK (length(name) > 0)
);

CREATE INDEX idx_library_tags_org ON public.library_tags (organization_id);

-- Tag-attachment junction (works with the existing attachments table)
CREATE TABLE public.attachment_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public.attachments ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.library_tags ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attachment_id, tag_id)
);

CREATE INDEX idx_attachment_tags_attachment ON public.attachment_tags (attachment_id);
CREATE INDEX idx_attachment_tags_tag ON public.attachment_tags (tag_id);

-- Add library-specific fields to existing attachments table
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.library_folders ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_attachments_folder ON public.attachments (folder_id) WHERE folder_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_pinned ON public.attachments (organization_id, is_pinned) WHERE is_pinned = true AND deleted_at IS NULL;

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.library_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible folders"
  ON public.library_folders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
    AND (
      visibility = 'organization'
      OR created_by = auth.uid()
      OR (visibility = 'department' AND department_id IN (
        SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Admin staff leader can create folders"
  ON public.library_folders FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role IN ('admin', 'staff', 'leader')
    )
  );

CREATE POLICY "Creators and admins update folders"
  ON public.library_folders FOR UPDATE
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Creators and admins delete folders"
  ON public.library_folders FOR DELETE
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users view org tags"
  ON public.library_tags FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admin staff leader manage tags"
  ON public.library_tags FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role IN ('admin', 'staff', 'leader')
    )
  );

CREATE POLICY "Users view attachment tags"
  ON public.attachment_tags FOR SELECT
  USING (
    attachment_id IN (
      SELECT id FROM public.attachments
      WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY "Authorized users manage attachment tags"
  ON public.attachment_tags FOR ALL
  USING (
    attachment_id IN (
      SELECT id FROM public.attachments
      WHERE uploaded_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND role IN ('admin', 'staff')
      )
    )
  );
