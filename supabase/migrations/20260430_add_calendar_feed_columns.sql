-- Add feed_type, department_id, and last_accessed_at to calendar_feed_tokens

alter table calendar_feed_tokens
  add column if not exists feed_type text not null default 'organization',
  add column if not exists department_id uuid references departments(id) on delete set null,
  add column if not exists last_accessed_at timestamptz;

-- Allow the service role to update last_accessed_at
create policy "Service role can update feed tokens"
  on calendar_feed_tokens for update
  using (true)
  with check (true);
