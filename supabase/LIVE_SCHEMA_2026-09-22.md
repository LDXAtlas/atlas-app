# Live schema — huddle tables — 2026-09-22

**Authoritative over the migration files.** These columns were read from
`information_schema.columns` in the live Supabase project on 2026-09-22.
The Phase 0/1 migration files (`supabase/migrations/20260612_*`,
`20260615_huddles_phase_1.sql`) do **not** describe the live huddle tables.
Where they disagree, this file is correct. See BACKEND_NOTES → PENDING.

Content: the `1_column` rows of a one-off schema query (columns, constraints,
indexes, triggers, RLS policies and functions on every `huddle*` table),
copied exactly as the Supabase SQL editor returned them. The rows cover every
`huddle*` table plus the AI-credit and huddle storage/retention columns on
`organizations`. The column part of that query:

```sql
SELECT table_name, column_name,
       concat_ws(' ', data_type,
                 CASE WHEN is_nullable = 'NO' THEN 'NOT NULL' END,
                 'DEFAULT ' || column_default) AS definition
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name LIKE 'huddle%'
       OR (table_name = 'organizations'
           AND (column_name LIKE '%huddle%' OR column_name LIKE '%recording%'
                OR column_name LIKE 'ai_credits%')))
ORDER BY table_name, column_name;
```

| kind         | tbl                 | name                                           | definition |
| ------------ | ------------------- | ---------------------------------------------- | ---------- |
| 1_column     | huddle_action_items | created_at                                     | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddle_action_items | description                                    | text NOT NULL |
| 1_column     | huddle_action_items | huddle_id                                      | uuid NOT NULL |
| 1_column     | huddle_action_items | id                                             | uuid NOT NULL DEFAULT gen_random_uuid() |
| 1_column     | huddle_action_items | source                                         | text DEFAULT 'manual'::text |
| 1_column     | huddle_action_items | status                                         | text DEFAULT 'pending'::text |
| 1_column     | huddle_action_items | suggested_assignee_id                          | uuid |
| 1_column     | huddle_action_items | suggested_due_date                             | timestamp with time zone |
| 1_column     | huddle_action_items | task_id                                        | uuid |
| 1_column     | huddle_agenda_items | created_at                                     | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddle_agenda_items | description                                    | text |
| 1_column     | huddle_agenda_items | estimated_minutes                              | integer |
| 1_column     | huddle_agenda_items | huddle_id                                      | uuid NOT NULL |
| 1_column     | huddle_agenda_items | id                                             | uuid NOT NULL DEFAULT gen_random_uuid() |
| 1_column     | huddle_agenda_items | is_completed                                   | boolean DEFAULT false |
| 1_column     | huddle_agenda_items | notes                                          | text |
| 1_column     | huddle_agenda_items | position                                       | integer NOT NULL DEFAULT 0 |
| 1_column     | huddle_agenda_items | presenter_id                                   | uuid |
| 1_column     | huddle_agenda_items | title                                          | text NOT NULL |
| 1_column     | huddle_attendees    | attended                                       | boolean |
| 1_column     | huddle_attendees    | attended_at                                    | timestamp with time zone |
| 1_column     | huddle_attendees    | huddle_id                                      | uuid NOT NULL |
| 1_column     | huddle_attendees    | id                                             | uuid NOT NULL DEFAULT gen_random_uuid() |
| 1_column     | huddle_attendees    | invited_at                                     | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddle_attendees    | member_id                                      | uuid |
| 1_column     | huddle_attendees    | profile_id                                     | uuid |
| 1_column     | huddle_attendees    | role                                           | text DEFAULT 'attendee'::text |
| 1_column     | huddle_decisions    | context                                        | text |
| 1_column     | huddle_decisions    | decided_at                                     | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddle_decisions    | decided_by                                     | uuid |
| 1_column     | huddle_decisions    | decision                                       | text NOT NULL |
| 1_column     | huddle_decisions    | huddle_id                                      | uuid NOT NULL |
| 1_column     | huddle_decisions    | id                                             | uuid NOT NULL DEFAULT gen_random_uuid() |
| 1_column     | huddle_decisions    | source                                         | text DEFAULT 'manual'::text |
| 1_column     | huddle_notes        | content                                        | text DEFAULT ''::text |
| 1_column     | huddle_notes        | huddle_id                                      | uuid NOT NULL |
| 1_column     | huddle_notes        | last_edited_at                                 | timestamp with time zone DEFAULT now() |
| 1_column     | huddle_notes        | last_edited_by                                 | uuid |
| 1_column     | huddle_recordings   | deleted_at                                     | timestamp with time zone |
| 1_column     | huddle_recordings   | duration_seconds                               | integer |
| 1_column     | huddle_recordings   | file_type                                      | text |
| 1_column     | huddle_recordings   | huddle_id                                      | uuid NOT NULL |
| 1_column     | huddle_recordings   | id                                             | uuid NOT NULL DEFAULT gen_random_uuid() |
| 1_column     | huddle_recordings   | size_bytes                                     | bigint |
| 1_column     | huddle_recordings   | source_type                                    | text NOT NULL |
| 1_column     | huddle_recordings   | storage_path                                   | text |
| 1_column     | huddle_recordings   | uploaded_at                                    | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddle_recordings   | uploaded_by                                    | uuid |
| 1_column     | huddle_summaries    | created_at                                     | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddle_summaries    | executive_summary                              | text |
| 1_column     | huddle_summaries    | huddle_id                                      | uuid NOT NULL |
| 1_column     | huddle_summaries    | id                                             | uuid NOT NULL DEFAULT gen_random_uuid() |
| 1_column     | huddle_summaries    | key_points                                     | jsonb |
| 1_column     | huddle_summaries    | model_used                                     | text |
| 1_column     | huddle_summaries    | sentiment_notes                                | text |
| 1_column     | huddle_summaries    | topics_discussed                               | jsonb |
| 1_column     | huddle_summaries    | transcript_id                                  | uuid |
| 1_column     | huddle_transcripts  | created_at                                     | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddle_transcripts  | full_text                                      | text NOT NULL |
| 1_column     | huddle_transcripts  | huddle_id                                      | uuid NOT NULL |
| 1_column     | huddle_transcripts  | id                                             | uuid NOT NULL DEFAULT gen_random_uuid() |
| 1_column     | huddle_transcripts  | language                                       | text DEFAULT 'en'::text |
| 1_column     | huddle_transcripts  | model_used                                     | text |
| 1_column     | huddle_transcripts  | recording_id                                   | uuid |
| 1_column     | huddle_transcripts  | segments                                       | jsonb |
| 1_column     | huddles             | actual_end                                     | timestamp with time zone |
| 1_column     | huddles             | actual_start                                   | timestamp with time zone |
| 1_column     | huddles             | created_at                                     | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddles             | created_by                                     | uuid NOT NULL |
| 1_column     | huddles             | department_id                                  | uuid |
| 1_column     | huddles             | description                                    | text |
| 1_column     | huddles             | external_meeting_id                            | text |
| 1_column     | huddles             | external_meeting_url                           | text |
| 1_column     | huddles             | id                                             | uuid NOT NULL DEFAULT gen_random_uuid() |
| 1_column     | huddles             | location                                       | text |
| 1_column     | huddles             | meeting_source                                 | text NOT NULL DEFAULT 'in_person'::text |
| 1_column     | huddles             | organization_id                                | uuid NOT NULL |
| 1_column     | huddles             | recording_deleted_at                           | timestamp with time zone |
| 1_column     | huddles             | recording_pinned                               | boolean DEFAULT false |
| 1_column     | huddles             | recording_retention_days                       | integer DEFAULT 30 |
| 1_column     | huddles             | scheduled_end                                  | timestamp with time zone |
| 1_column     | huddles             | scheduled_start                                | timestamp with time zone |
| 1_column     | huddles             | status                                         | text NOT NULL DEFAULT 'scheduled'::text |
| 1_column     | huddles             | timezone                                       | text DEFAULT 'America/New_York'::text |
| 1_column     | huddles             | title                                          | text NOT NULL |
| 1_column     | huddles             | updated_at                                     | timestamp with time zone NOT NULL DEFAULT now() |
| 1_column     | huddles             | visibility                                     | text NOT NULL DEFAULT 'invitees_only'::text |
| 1_column     | organizations       | ai_credits_limit                               | integer DEFAULT 500 |
| 1_column     | organizations       | ai_credits_reset_at                            | timestamp with time zone DEFAULT (date_trunc('month'::text, now()) + '1 mon'::interval) |
| 1_column     | organizations       | ai_credits_used                                | integer DEFAULT 0 |
| 1_column     | organizations       | default_recording_retention_days               | integer DEFAULT 30 |
| 1_column     | organizations       | huddle_storage_limit_bytes                     | bigint DEFAULT '10737418240'::bigint |
| 1_column     | organizations       | huddle_storage_used_bytes                      | bigint DEFAULT 0 |
