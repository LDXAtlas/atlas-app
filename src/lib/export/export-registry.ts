// ─── Organization Data Export — entity registry ──────────────────────────
//
// Single source of truth for "what does an org's data export contain?".
// Mirrors the pattern in src/lib/ai/feature-registry.ts: declare data, let
// the engine iterate. Adding a future module (Serve, Care, …) means adding
// entries here — never rewriting the export logic in
// src/app/actions/data-export.ts.
//
// Two hard rules this file encodes:
//   1. Org-scoping is DECLARED per table, never guessed. Some tables carry a
//      direct `organization_id`; others are reached only through a parent
//      (a board's cards, a huddle's notes). Getting this wrong is how an
//      export would leak another org's rows or silently drop data — so the
//      scope is explicit for every entity.
//   2. Fields are an ALLOW-LIST. We never `SELECT *` and never introspect the
//      schema to decide what to emit — that would leak columns like Stripe IDs
//      or secret tokens the moment they're added. Anything deliberately left
//      out of a table is recorded in `redactedFields` WITH A REASON so the
//      omission is visible and reversible, not silent.
//
// Bump EXPORT_SCHEMA_VERSION whenever the shape changes so older downloaded
// files stay interpretable as the schema evolves.

export const EXPORT_SCHEMA_VERSION = 1;

/** How an entity's rows are constrained to the requesting organization. */
export type ExportScope =
  // The organizations row itself, matched on `id`.
  | { readonly type: "org_root" }
  // Table has a direct `organization_id` column.
  | { readonly type: "direct" }
  // Table is reached through a parent entity already fetched this run:
  // filter `parentKey IN (ids collected from parentEntity)`.
  | { readonly type: "via"; readonly parentEntity: string; readonly parentKey: string };

export interface RedactedField {
  readonly field: string;
  readonly reason: string;
}

export interface ExportEntity {
  /** Stable key under `data` in the export JSON. */
  readonly key: string;
  /** Human-readable label for UI / docs. */
  readonly label: string;
  /** Physical Postgres table name. */
  readonly table: string;
  readonly scope: ExportScope;
  /** Allow-listed columns to select and emit. Never `*`. */
  readonly fields: readonly string[];
  /** Columns deliberately NOT exported, each with a reason. Documented, not selected. */
  readonly redactedFields?: readonly RedactedField[];
  /**
   * Column whose values are collected so child entities can scope to them.
   * Defaults to "id". Set to null for leaf tables with no children or no `id`
   * column (e.g. huddle_notes, whose PK is huddle_id).
   */
  readonly idField?: string | null;
  readonly notes?: string;
}

// Ordered parents-before-children so `via` entities can resolve their parent's
// collected ids. The engine relies on this ordering.
export const EXPORT_REGISTRY: readonly ExportEntity[] = [
  // ── Organization ────────────────────────────────────────────────────────
  {
    key: "organization",
    label: "Organization details",
    table: "organizations",
    scope: { type: "org_root" },
    fields: ["id", "name", "slug", "logo_url", "timezone", "subscription_tier", "created_at"],
    redactedFields: [
      { field: "stripe_customer_id", reason: "Stripe billing identifier — Atlas/Stripe internal, not church content." },
    ],
  },

  // ── People ──────────────────────────────────────────────────────────────
  {
    key: "staff_profiles",
    label: "Staff / user profiles",
    table: "profiles",
    scope: { type: "direct" },
    fields: ["id", "organization_id", "email", "full_name", "avatar_url", "role", "phone", "last_active", "created_at"],
  },
  {
    key: "departments",
    label: "Ministry areas / departments",
    table: "departments",
    scope: { type: "direct" },
    fields: ["id", "organization_id", "name", "color", "description", "icon", "leader_id", "member_count", "hub_enabled", "created_at"],
  },
  {
    key: "staff_department_assignments",
    label: "Staff → department assignments",
    table: "profile_departments",
    scope: { type: "via", parentEntity: "staff_profiles", parentKey: "profile_id" },
    fields: ["profile_id", "department_id", "is_primary"],
    idField: null,
  },
  {
    key: "members",
    label: "Congregation / member directory",
    table: "members",
    scope: { type: "direct" },
    // Full member record. `notes` is included deliberately: it's the church's
    // own free-text record about their own people (the least-reproducible data
    // in the export), gated by the same admin permission that can already read
    // it in-app. Sensitivity is handled by access control + disclosure, not by
    // dropping the field.
    fields: [
      "id", "organization_id", "first_name", "last_name", "email", "phone",
      "address_line_1", "address_line_2", "city", "state", "zip",
      "gender", "birthdate", "membership_status", "member_type", "notes", "created_at",
    ],
  },
  {
    key: "member_tags",
    label: "Member tags",
    table: "member_tags",
    scope: { type: "via", parentEntity: "members", parentKey: "member_id" },
    fields: ["member_id", "tag"],
    idField: null,
  },

  // ── Announcements ─────────────────────────────────────────────────────────
  {
    key: "announcements",
    label: "Announcements",
    table: "announcements",
    scope: { type: "direct" },
    fields: ["id", "organization_id", "author_id", "title", "content", "category", "is_pinned", "is_published", "published_at", "created_at", "updated_at"],
  },

  // ── Tasks ──────────────────────────────────────────────────────────────────
  {
    key: "tasks",
    label: "Tasks",
    table: "tasks",
    scope: { type: "direct" },
    fields: ["id", "organization_id", "title", "description", "status", "priority", "due_date", "completed_at", "assigned_to", "assigned_by", "department_id", "parent_task_id", "position", "created_at", "updated_at"],
  },
  {
    key: "task_comments",
    label: "Task comments",
    table: "task_comments",
    scope: { type: "via", parentEntity: "tasks", parentKey: "task_id" },
    fields: ["id", "task_id", "author_id", "content", "created_at", "updated_at"],
    idField: null,
  },
  {
    key: "task_activity",
    label: "Task activity log",
    table: "task_activity",
    scope: { type: "via", parentEntity: "tasks", parentKey: "task_id" },
    fields: ["id", "task_id", "actor_id", "action", "details", "created_at"],
    idField: null,
  },

  // ── Calendar ────────────────────────────────────────────────────────────────
  {
    key: "events",
    label: "Calendar events",
    table: "events",
    scope: { type: "direct" },
    fields: [
      "id", "organization_id", "title", "description", "event_type", "visibility",
      "starts_at", "ends_at", "is_all_day", "timezone", "location", "location_type",
      "virtual_url", "color", "department_id", "owner_user_id",
      "recurrence_frequency", "recurrence_interval", "recurrence_end_date", "recurrence_parent_id",
      "external_calendar_id", "external_calendar_type", "external_event_id",
      "reminders", "status", "created_by", "created_at", "updated_at",
    ],
  },
  {
    key: "event_departments",
    label: "Event → department links",
    table: "event_departments",
    scope: { type: "via", parentEntity: "events", parentKey: "event_id" },
    fields: ["id", "event_id", "department_id"],
    idField: null,
  },
  {
    key: "event_attendees",
    label: "Event attendees / RSVPs",
    table: "event_attendees",
    scope: { type: "via", parentEntity: "events", parentKey: "event_id" },
    fields: ["id", "event_id", "user_id", "member_id", "role", "rsvp_status", "responded_at", "added_at"],
    idField: null,
  },
  {
    key: "custom_event_types",
    label: "Custom event types",
    table: "custom_event_types",
    scope: { type: "direct" },
    fields: ["id", "organization_id", "name", "color", "created_by", "created_at"],
  },

  // ── Project boards ────────────────────────────────────────────────────────
  {
    key: "boards",
    label: "Project boards",
    table: "boards",
    scope: { type: "direct" },
    fields: ["id", "organization_id", "name", "description", "color", "icon", "department_id", "visibility", "is_archived", "created_by", "created_at", "updated_at"],
  },
  {
    key: "board_columns",
    label: "Board columns / lists",
    table: "board_columns",
    scope: { type: "via", parentEntity: "boards", parentKey: "board_id" },
    fields: ["id", "board_id", "name", "color", "position", "created_at"],
  },
  {
    key: "board_cards",
    label: "Board cards",
    table: "board_cards",
    scope: { type: "via", parentEntity: "boards", parentKey: "board_id" },
    fields: ["id", "board_id", "column_id", "title", "description", "cover_color", "due_date", "assigned_to", "position", "is_completed", "completed_at", "created_by", "created_at", "updated_at"],
  },
  {
    key: "card_checklist_items",
    label: "Card checklist items",
    table: "card_checklist_items",
    scope: { type: "via", parentEntity: "board_cards", parentKey: "card_id" },
    fields: ["id", "card_id", "title", "is_completed", "completed_at", "position", "created_at"],
    idField: null,
  },
  {
    key: "card_comments",
    label: "Card comments",
    table: "card_comments",
    scope: { type: "via", parentEntity: "board_cards", parentKey: "card_id" },
    fields: ["id", "card_id", "author_id", "content", "created_at", "updated_at"],
    idField: null,
  },
  {
    key: "card_label_assignments",
    label: "Card → label links",
    table: "board_card_labels",
    scope: { type: "via", parentEntity: "board_cards", parentKey: "card_id" },
    fields: ["id", "card_id", "label_id"],
    idField: null,
  },
  {
    key: "card_activity",
    label: "Board activity log",
    table: "card_activity",
    scope: { type: "via", parentEntity: "board_cards", parentKey: "card_id" },
    fields: ["id", "card_id", "actor_id", "action_type", "metadata", "created_at"],
    idField: null,
  },
  {
    key: "board_labels",
    label: "Board labels",
    table: "card_labels",
    scope: { type: "via", parentEntity: "boards", parentKey: "board_id" },
    fields: ["id", "board_id", "name", "color", "created_at"],
    idField: null,
  },
  {
    key: "board_members",
    label: "Board members",
    table: "board_members",
    scope: { type: "via", parentEntity: "boards", parentKey: "board_id" },
    fields: ["id", "board_id", "profile_id", "role", "added_at"],
    idField: null,
  },

  // ── Huddles (data only — Ben owns the UI, untouched here) ────────────────
  {
    key: "huddles",
    label: "Huddles (meetings)",
    table: "huddles",
    scope: { type: "direct" },
    fields: [
      "id", "organization_id", "title", "description", "scheduled_start", "scheduled_end",
      "actual_start", "actual_end", "timezone", "meeting_source", "external_meeting_url",
      "external_meeting_id", "location", "department_id", "status", "visibility",
      "recording_retention_days", "recording_pinned", "recording_deleted_at",
      "created_by", "created_at", "updated_at",
    ],
  },
  {
    key: "huddle_attendees",
    label: "Huddle attendees",
    table: "huddle_attendees",
    scope: { type: "via", parentEntity: "huddles", parentKey: "huddle_id" },
    fields: ["id", "huddle_id", "profile_id", "member_id", "role", "attended", "attended_at", "invited_at"],
    idField: null,
  },
  {
    key: "huddle_agenda_items",
    label: "Huddle agenda items",
    table: "huddle_agenda_items",
    scope: { type: "via", parentEntity: "huddles", parentKey: "huddle_id" },
    fields: ["id", "huddle_id", "title", "description", "estimated_minutes", "presenter_id", "position", "is_completed", "notes", "created_at"],
    idField: null,
  },
  {
    key: "huddle_notes",
    label: "Huddle notes",
    table: "huddle_notes",
    scope: { type: "via", parentEntity: "huddles", parentKey: "huddle_id" },
    fields: ["huddle_id", "content", "last_edited_by", "last_edited_at"],
    idField: null,
  },
  {
    key: "huddle_decisions",
    label: "Huddle decisions",
    table: "huddle_decisions",
    scope: { type: "via", parentEntity: "huddles", parentKey: "huddle_id" },
    fields: ["id", "huddle_id", "decision", "context", "decided_by", "source", "created_at"],
    idField: null,
  },
  {
    key: "huddle_action_items",
    label: "Huddle action items",
    table: "huddle_action_items",
    scope: { type: "via", parentEntity: "huddles", parentKey: "huddle_id" },
    fields: ["id", "huddle_id", "task_id", "description", "suggested_assignee_id", "suggested_due_date", "source", "status", "created_at"],
    idField: null,
  },

  // ── Library (file METADATA only — never the file blobs, per v1 scope) ─────
  {
    key: "library_files",
    label: "Library file metadata",
    table: "attachments",
    scope: { type: "direct" },
    fields: [
      "id", "organization_id", "entity_type", "entity_id", "name", "description",
      "file_type", "file_extension", "size_bytes", "mime_type",
      "uploaded_by", "uploaded_at", "deleted_at",
    ],
    redactedFields: [
      { field: "storage_path", reason: "Internal Supabase Storage object key; file blobs are out of scope for export v1." },
      { field: "thumbnail_path", reason: "Internal Supabase Storage object key; file blobs are out of scope for export v1." },
    ],
    notes: "Metadata only — the actual file bytes are not part of export v1.",
  },
  {
    key: "library_folders",
    label: "Library folders",
    table: "library_folders",
    scope: { type: "direct" },
    fields: ["id", "organization_id", "name", "parent_folder_id", "description", "color", "icon", "visibility", "department_id", "created_by", "created_at", "updated_at"],
  },
  {
    key: "library_tags",
    label: "Library tags",
    table: "library_tags",
    scope: { type: "direct" },
    fields: ["id", "organization_id", "name", "color", "created_by", "created_at"],
  },
  {
    key: "library_file_tags",
    label: "Library file → tag links",
    table: "attachment_tags",
    scope: { type: "via", parentEntity: "library_files", parentKey: "attachment_id" },
    fields: ["id", "attachment_id", "tag_id", "added_at"],
    idField: null,
  },

  // ── AI guidelines (church-authored fields ONLY) ──────────────────────────
  {
    key: "ai_guidelines",
    label: "AI guidelines (church-authored)",
    table: "organization_ai_settings",
    scope: { type: "direct" },
    fields: ["organization_id", "voice_tone", "terminology", "about_church", "things_to_avoid", "additional_guidelines"],
    redactedFields: [
      { field: "model_preference", reason: "Atlas operational config (which model tier to use), not church content." },
      { field: "ai_enabled", reason: "Atlas operational config (feature master switch), not church content." },
      { field: "updated_by", reason: "Internal audit field." },
      { field: "updated_at", reason: "Internal audit field." },
    ],
    idField: null,
  },
] as const;

// Org-scoped tables (they carry an `organization_id`) that we DELIBERATELY do
// not export as entities. Declared with a reason so the completeness check
// treats them as "known and intentionally excluded" rather than a silent gap —
// and so a reviewer can see exactly what was withheld and why.
export const EXCLUDED_ORG_TABLES: readonly RedactedField[] = [
  { field: "ai_usage_log", reason: "Internal AI credit/billing audit log — Atlas operational data, not church content." },
  { field: "calendar_feed_tokens", reason: "Contains secret per-user ICS calendar-feed access tokens — excluded for security." },
  { field: "notifications", reason: "Transient per-user in-app notifications — not meaningful portable data." },
  { field: "invitations", reason: "Unaccepted staff invites (transient) and contains secret accept tokens — excluded." },
] as const;

/**
 * Tables the registry already knows about — either exported as a directly
 * org-scoped entity, deliberately excluded, or the organizations root itself.
 * The completeness check diffs the LIVE set of org-scoped tables against this
 * so a future engineer who adds an org-scoped table and forgets to register it
 * gets a soft warning instead of shipping churches a quietly-incomplete file.
 * (Parent-scoped child tables have no `organization_id` and so never appear in
 * the live org-scoped set — they're covered via their registered parent.)
 */
export function knownOrgScopedTables(): Set<string> {
  const known = new Set<string>(["organizations"]);
  for (const e of EXPORT_REGISTRY) {
    if (e.scope.type === "direct" || e.scope.type === "org_root") known.add(e.table);
  }
  for (const x of EXCLUDED_ORG_TABLES) known.add(x.field);
  return known;
}
