-- Update handle_new_user trigger to skip org creation for invited users.
-- When a user is created via team invitation, the acceptInvitation server action
-- sets 'invited_to_org' in user_metadata. The trigger checks for this and skips
-- org creation, since the action handles profile + org linking separately.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- If user was created via team invitation, skip org creation.
  -- The acceptInvitation server action handles profile + org linking.
  IF new.raw_user_meta_data ->> 'invited_to_org' IS NOT NULL THEN
    RETURN new;
  END IF;

  -- Create a default organization for the new user
  INSERT INTO public.organizations (name, slug)
  VALUES (
    coalesce(new.raw_user_meta_data ->> 'organization_name', 'My Organization'),
    coalesce(
      new.raw_user_meta_data ->> 'organization_slug',
      replace(new.id::text, '-', '')
    )
  )
  RETURNING id INTO new_org_id;

  -- Create the profile with admin role (first user in the org)
  INSERT INTO public.profiles (id, organization_id, email, full_name, role)
  VALUES (
    new.id,
    new_org_id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'admin'
  );

  RETURN new;
END;
$$;
