-- Add department targeting to announcements
-- target_department_id is null = visible to everyone
-- target_department_id is set = targeted to that department
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS target_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_target_department
  ON public.announcements (organization_id, target_department_id);
