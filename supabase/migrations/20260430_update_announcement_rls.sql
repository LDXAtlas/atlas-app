-- Update announcement RLS policies for proper author-or-admin permissions
-- Authors can edit/delete their own; admins can edit/delete any

DROP POLICY IF EXISTS "Admin and staff can create announcements" ON public.announcements;
CREATE POLICY "Admin and staff can create announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "Authors and admins can update announcements" ON public.announcements;
CREATE POLICY "Authors and admins can update announcements"
  ON public.announcements FOR UPDATE
  USING (
    author_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authors and admins can delete announcements" ON public.announcements;
CREATE POLICY "Authors and admins can delete announcements"
  ON public.announcements FOR DELETE
  USING (
    author_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE profiles.id = auth.uid() AND role = 'admin'
    )
  );
