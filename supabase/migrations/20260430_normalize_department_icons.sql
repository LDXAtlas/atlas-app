UPDATE public.departments
SET icon = 'Building'
WHERE icon = 'building' OR icon IS NULL OR icon = '';
