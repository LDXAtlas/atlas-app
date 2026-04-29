-- ─── Event Types & Enums ────────────────────────────────────────

create type event_type as enum (
  'general', 'service', 'meeting', 'rehearsal', 'class', 'outreach', 'social', 'other'
);

create type event_visibility as enum ('public', 'members', 'staff', 'private');

create type event_location_type as enum ('in_person', 'virtual', 'hybrid');

create type event_status as enum ('confirmed', 'tentative', 'cancelled');

create type event_recurrence_frequency as enum (
  'none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'
);

create type attendee_role as enum ('attendee', 'organizer', 'speaker', 'volunteer');

create type rsvp_status as enum ('pending', 'accepted', 'declined', 'tentative');

-- ─── Events Table ───────────────────────────────────────────────

create table if not exists events (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  title                  text not null,
  description            text,
  event_type             event_type not null default 'general',
  visibility             event_visibility not null default 'public',
  starts_at              timestamptz not null,
  ends_at                timestamptz,
  is_all_day             boolean not null default false,
  timezone               text not null default 'America/New_York',
  location               text,
  location_type          event_location_type not null default 'in_person',
  virtual_url            text,
  color                  text not null default '#5CE1A5',
  department_id          uuid references departments(id) on delete set null,
  owner_user_id          uuid references profiles(id) on delete set null,
  recurrence_frequency   event_recurrence_frequency not null default 'none',
  recurrence_interval    integer default 1,
  recurrence_end_date    timestamptz,
  recurrence_parent_id   uuid references events(id) on delete cascade,
  external_calendar_id   text,
  external_calendar_type text,
  external_event_id      text,
  reminders              jsonb default '[]'::jsonb,
  status                 event_status not null default 'confirmed',
  created_by             uuid references profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_events_org on events(organization_id);
create index idx_events_starts_at on events(starts_at);
create index idx_events_ends_at on events(ends_at);
create index idx_events_event_type on events(event_type);
create index idx_events_status on events(status);
create index idx_events_department on events(department_id);
create index idx_events_owner on events(owner_user_id);
create index idx_events_org_starts on events(organization_id, starts_at);

-- RLS
alter table events enable row level security;

create policy "Users can view events in their org"
  on events for select
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

create policy "Users can insert events in their org"
  on events for insert
  with check (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

create policy "Users can update events in their org"
  on events for update
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

create policy "Users can delete events in their org"
  on events for delete
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

-- ─── Event Attendees ────────────────────────────────────────────

create table if not exists event_attendees (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  member_id   uuid references members(id) on delete cascade,
  role        attendee_role not null default 'attendee',
  rsvp_status rsvp_status not null default 'pending',
  responded_at timestamptz,
  added_at    timestamptz not null default now()
);

create index idx_event_attendees_event on event_attendees(event_id);
create index idx_event_attendees_user on event_attendees(user_id);
create index idx_event_attendees_member on event_attendees(member_id);

alter table event_attendees enable row level security;

create policy "Users can view attendees for events in their org"
  on event_attendees for select
  using (
    event_id in (
      select e.id from events e
      join profiles p on p.organization_id = e.organization_id
      where p.id = auth.uid()
    )
  );

create policy "Users can insert attendees for events in their org"
  on event_attendees for insert
  with check (
    event_id in (
      select e.id from events e
      join profiles p on p.organization_id = e.organization_id
      where p.id = auth.uid()
    )
  );

create policy "Users can update attendees for events in their org"
  on event_attendees for update
  using (
    event_id in (
      select e.id from events e
      join profiles p on p.organization_id = e.organization_id
      where p.id = auth.uid()
    )
  );

create policy "Users can delete attendees for events in their org"
  on event_attendees for delete
  using (
    event_id in (
      select e.id from events e
      join profiles p on p.organization_id = e.organization_id
      where p.id = auth.uid()
    )
  );

-- ─── Event Departments (many-to-many) ───────────────────────────

create table if not exists event_departments (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  unique(event_id, department_id)
);

create index idx_event_departments_event on event_departments(event_id);
create index idx_event_departments_dept on event_departments(department_id);

alter table event_departments enable row level security;

create policy "Users can view event departments in their org"
  on event_departments for select
  using (
    event_id in (
      select e.id from events e
      join profiles p on p.organization_id = e.organization_id
      where p.id = auth.uid()
    )
  );

create policy "Users can insert event departments in their org"
  on event_departments for insert
  with check (
    event_id in (
      select e.id from events e
      join profiles p on p.organization_id = e.organization_id
      where p.id = auth.uid()
    )
  );

create policy "Users can delete event departments in their org"
  on event_departments for delete
  using (
    event_id in (
      select e.id from events e
      join profiles p on p.organization_id = e.organization_id
      where p.id = auth.uid()
    )
  );

-- ─── Calendar Feed Tokens ───────────────────────────────────────

create table if not exists calendar_feed_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz
);

create index idx_calendar_feed_tokens_user on calendar_feed_tokens(user_id);
create index idx_calendar_feed_tokens_token on calendar_feed_tokens(token);

alter table calendar_feed_tokens enable row level security;

create policy "Users can view their own feed tokens"
  on calendar_feed_tokens for select
  using (user_id = auth.uid());

create policy "Users can insert their own feed tokens"
  on calendar_feed_tokens for insert
  with check (user_id = auth.uid());

create policy "Users can delete their own feed tokens"
  on calendar_feed_tokens for delete
  using (user_id = auth.uid());
