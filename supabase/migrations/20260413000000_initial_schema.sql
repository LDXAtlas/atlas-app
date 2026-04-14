-- Atlas Church Solutions — Initial Schema
-- organizations, profiles, RLS policies, and auth trigger

-- ============================================================
-- TABLES
-- ============================================================

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  timezone    text not null default 'America/New_York',
  subscription_tier text not null default 'workspace',
  stripe_customer_id text,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  email           text not null,
  full_name       text not null,
  avatar_url      text,
  role            text not null default 'admin',
  phone           text,
  last_active     timestamptz,
  created_at      timestamptz not null default now()
);

-- Index for the most common query pattern: fetching profiles by org
create index idx_profiles_organization_id on public.profiles (organization_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

-- Organizations: users can only see the org they belong to
create policy "Users can view their own organization"
  on public.organizations for select
  using (
    id in (
      select organization_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

-- Profiles: users can only see profiles within their organization
create policy "Users can view profiles in their organization"
  on public.profiles for select
  using (
    organization_id in (
      select organization_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

-- Profiles: users can update their own profile
create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Allow inserts during signup (the trigger runs as SECURITY DEFINER,
-- but explicit insert policies are needed if client code ever creates
-- orgs/profiles directly).
create policy "Allow insert for authenticated users"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "Allow insert for own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- ============================================================
-- AUTH TRIGGER: auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer          -- runs with table-owner privileges
set search_path = ''      -- guard against search_path hijacking
as $$
declare
  new_org_id uuid;
begin
  -- Create a default organization for the new user
  insert into public.organizations (name, slug)
  values (
    coalesce(new.raw_user_meta_data ->> 'organization_name', 'My Organization'),
    coalesce(
      new.raw_user_meta_data ->> 'organization_slug',
      replace(new.id::text, '-', '')
    )
  )
  returning id into new_org_id;

  -- Create the profile with admin role (first user in the org)
  insert into public.profiles (id, organization_id, email, full_name, role)
  values (
    new.id,
    new_org_id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'admin'
  );

  return new;
end;
$$;

-- Fire after every new row in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
