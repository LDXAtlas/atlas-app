-- ─── Custom Event Types ─────────────────────────────────────────

create table if not exists custom_event_types (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  color           text not null default '#6B7280',
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique(organization_id, name)
);

create index idx_custom_event_types_org on custom_event_types(organization_id);

alter table custom_event_types enable row level security;

create policy "Users can view custom event types in their org"
  on custom_event_types for select
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

create policy "Users can insert custom event types in their org"
  on custom_event_types for insert
  with check (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

create policy "Users can delete custom event types in their org"
  on custom_event_types for delete
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

-- Add recurrence_rule column to events if not exists
alter table events add column if not exists recurrence_rule text;

-- Add custom_event_type_id to events for custom type support
alter table events add column if not exists custom_event_type_id uuid references custom_event_types(id) on delete set null;
create index if not exists idx_events_custom_type on events(custom_event_type_id) where custom_event_type_id is not null;

-- Add update policy for custom event types
create policy "Users can update custom event types in their org"
  on custom_event_types for update
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );
