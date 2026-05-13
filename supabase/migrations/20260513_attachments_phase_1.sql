-- Library Foundation Schema (Phase 1)
--
-- NOTE: This file is documentation only. The schema is already live in
-- Supabase from SQL run earlier; do not re-apply this migration against
-- a database that already has these tables.

-- Universal attachments table — used by tasks, announcements,
-- board cards, events, and standalone library uploads
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,

  -- Polymorphic association
  entity_type text NOT NULL CHECK (entity_type IN ('task', 'announcement', 'board_card', 'event', 'library')),
  entity_id uuid NOT NULL,

  -- File metadata
  name text NOT NULL,
  description text,
  file_type text NOT NULL,
  file_extension text,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),  -- 25MB cap
  storage_path text NOT NULL UNIQUE,
  thumbnail_path text,
  mime_type text,

  -- Tracking
  uploaded_by uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT name_not_empty CHECK (length(name) > 0)
);

CREATE INDEX idx_attachments_org ON public.attachments (organization_id);
CREATE INDEX idx_attachments_entity ON public.attachments (entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_uploader ON public.attachments (uploaded_by);
CREATE INDEX idx_attachments_deleted ON public.attachments (organization_id, deleted_at);
CREATE INDEX idx_attachments_uploaded_at ON public.attachments (organization_id, uploaded_at DESC) WHERE deleted_at IS NULL;

-- Storage tracking on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS storage_used_bytes bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_limit_bytes bigint DEFAULT 2147483648;  -- 2GB Workspace default

-- Auto-update storage usage on attachment changes.
-- Trigger only fires on INSERT + hard DELETE — soft deletes (setting
-- deleted_at) must manually decrement storage_used_bytes via the server action.
CREATE OR REPLACE FUNCTION public.update_org_storage_on_attachment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.organizations
    SET storage_used_bytes = storage_used_bytes + NEW.size_bytes
    WHERE id = NEW.organization_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.organizations
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.size_bytes)
    WHERE id = OLD.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.update_org_storage_on_attachment() FROM anon, authenticated;

CREATE TRIGGER attachments_storage_tracking
  AFTER INSERT OR DELETE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_org_storage_on_attachment();

-- Row Level Security
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Users can view attachments in their org (visibility-aware based on parent entity)
CREATE POLICY "Users can view attachments in their org"
  ON public.attachments FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
    AND deleted_at IS NULL
  );

-- Admin, staff, and leader roles can upload attachments
CREATE POLICY "Authorized users can upload attachments"
  ON public.attachments FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role IN ('admin', 'staff', 'leader')
    )
  );

-- Uploaders and admins can update attachments
CREATE POLICY "Uploaders and admins can update attachments"
  ON public.attachments FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role = 'admin'
    )
  );

-- Uploaders and admins can delete attachments
CREATE POLICY "Uploaders and admins can delete attachments"
  ON public.attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role = 'admin'
    )
  );

-- Initial tier storage limits — sensible defaults based on existing
-- organizations' subscription tiers.
UPDATE public.organizations
SET storage_limit_bytes = CASE
  WHEN subscription_tier = 'workspace' THEN 2147483648    -- 2 GB
  WHEN subscription_tier = 'suite' THEN 10737418240        -- 10 GB
  WHEN subscription_tier = 'ultimate' THEN 53687091200     -- 50 GB
  ELSE 2147483648                                          -- Default to Workspace
END
WHERE storage_limit_bytes IS NULL OR storage_limit_bytes = 0;
