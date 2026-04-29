-- ─── Tasks ──────────────────────────────────────────────────────

create type task_status as enum ('todo', 'in_progress', 'done', 'blocked');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');

create table if not exists tasks (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title          text not null,
  description    text,
  status         task_status not null default 'todo',
  priority       task_priority not null default 'low',
  due_date       timestamptz,
  completed_at   timestamptz,
  assigned_to    uuid references profiles(id) on delete set null,
  assigned_by    uuid references profiles(id) on delete set null,
  department_id  uuid references departments(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete cascade,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_tasks_org on tasks(organization_id);
create index idx_tasks_assigned_to on tasks(assigned_to);
create index idx_tasks_assigned_by on tasks(assigned_by);
create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_status on tasks(status);

-- RLS
alter table tasks enable row level security;

create policy "Users can view tasks in their org"
  on tasks for select
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

create policy "Users can insert tasks in their org"
  on tasks for insert
  with check (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

create policy "Users can update tasks in their org"
  on tasks for update
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

create policy "Users can delete tasks in their org"
  on tasks for delete
  using (
    organization_id in (
      select o.id from organizations o
      join profiles p on p.organization_id = o.id
      where p.id = auth.uid()
    )
  );

-- ─── Task Comments ──────────────────────────────────────────────

create table if not exists task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_task_comments_task on task_comments(task_id);

alter table task_comments enable row level security;

create policy "Users can view comments on tasks in their org"
  on task_comments for select
  using (
    task_id in (
      select t.id from tasks t
      join profiles p on p.organization_id = t.organization_id
      where p.id = auth.uid()
    )
  );

create policy "Users can insert comments on tasks in their org"
  on task_comments for insert
  with check (
    task_id in (
      select t.id from tasks t
      join profiles p on p.organization_id = t.organization_id
      where p.id = auth.uid()
    )
  );

-- ─── Task Activity ──────────────────────────────────────────────

create table if not exists task_activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  actor_id   uuid not null references profiles(id) on delete cascade,
  action     text not null,
  details    jsonb,
  created_at timestamptz not null default now()
);

create index idx_task_activity_task on task_activity(task_id);

alter table task_activity enable row level security;

create policy "Users can view activity on tasks in their org"
  on task_activity for select
  using (
    task_id in (
      select t.id from tasks t
      join profiles p on p.organization_id = t.organization_id
      where p.id = auth.uid()
    )
  );

create policy "Users can insert activity on tasks in their org"
  on task_activity for insert
  with check (
    task_id in (
      select t.id from tasks t
      join profiles p on p.organization_id = t.organization_id
      where p.id = auth.uid()
    )
  );
