-- Departments table for organization structure
create table if not exists public.departments (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  color text default '#5CE1A5',
  description text,
  icon text default 'building',
  leader_id uuid,
  member_count integer default 0,
  hub_enabled boolean default false,
  created_at timestamptz default now()
);

-- RLS policies (same pattern as members)
alter table public.departments enable row level security;

create policy "Users can view departments in their organization"
  on public.departments for select
  using (
    organization_id in (
      select id from public.organizations
      where slug = (
        select raw_user_meta_data->>'organization_slug'
        from auth.users
        where id = auth.uid()
      )
    )
  );

create policy "Users can insert departments in their organization"
  on public.departments for insert
  with check (
    organization_id in (
      select id from public.organizations
      where slug = (
        select raw_user_meta_data->>'organization_slug'
        from auth.users
        where id = auth.uid()
      )
    )
  );

create policy "Users can update departments in their organization"
  on public.departments for update
  using (
    organization_id in (
      select id from public.organizations
      where slug = (
        select raw_user_meta_data->>'organization_slug'
        from auth.users
        where id = auth.uid()
      )
    )
  );

create policy "Users can delete departments in their organization"
  on public.departments for delete
  using (
    organization_id in (
      select id from public.organizations
      where slug = (
        select raw_user_meta_data->>'organization_slug'
        from auth.users
        where id = auth.uid()
      )
    )
  );
