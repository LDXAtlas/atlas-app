"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";
import {
  EXPORT_REGISTRY,
  EXPORT_SCHEMA_VERSION,
  EXCLUDED_ORG_TABLES,
  knownOrgScopedTables,
  type ExportEntity,
} from "@/lib/export/export-registry";

// ─── Types ────────────────────────────────────────────────
export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

export interface ExportResult {
  filename: string;
  /** Pretty-printed JSON, ready to hand to a Blob download on the client. */
  json: string;
  /** Lightweight summary for the UI (counts + any warnings) without re-parsing. */
  summary: {
    totalRecords: number;
    entityCount: number;
    warnings: string[];
  };
}

// ─── Auth + admin gate (matches organizations.ts / ai-settings.ts) ─────────
async function getAdminContext(): Promise<
  { userId: string; organizationId: string } | { error: string; code: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", code: "UNAUTHENTICATED" };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) {
    return { error: "No organization found.", code: "BAD_INPUT" };
  }
  const role = getRoleFromProfile(profile);
  if (!can.editOrganization(role)) {
    return {
      error: "Only an organization admin can export organization data.",
      code: "FORBIDDEN",
    };
  }
  return { userId: user.id, organizationId: profile.organization_id };
}

// ─── Live schema (via PostgREST OpenAPI, no migration required) ────────────
//
// Fetching the REST root returns an OpenAPI doc describing every table in the
// exposed `public` schema and its columns. We use it for two things, both
// best-effort: (1) intersect each entity's declared allow-list with columns
// that actually exist, so a not-yet-applied migration degrades to a soft
// warning instead of erroring a query; (2) the completeness check below.
// If this fetch fails we fall back to the declared fields and say so.
interface LiveSchema {
  available: boolean;
  columnsByTable: Map<string, Set<string>>;
  orgScopedTables: Set<string>;
}

async function loadLiveSchema(): Promise<LiveSchema> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const empty: LiveSchema = {
    available: false,
    columnsByTable: new Map(),
    orgScopedTables: new Set(),
  };
  if (!url || !key) return empty;

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const spec = (await res.json()) as {
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
      components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
    };
    const defs = spec.definitions ?? spec.components?.schemas;
    if (!defs) return empty;

    const columnsByTable = new Map<string, Set<string>>();
    const orgScopedTables = new Set<string>();
    for (const [table, def] of Object.entries(defs)) {
      const cols = new Set(Object.keys(def.properties ?? {}));
      columnsByTable.set(table, cols);
      if (cols.has("organization_id")) orgScopedTables.add(table);
    }
    return { available: true, columnsByTable, orgScopedTables };
  } catch {
    return empty;
  }
}

// PostgREST `.in()` on a very long id list can blow past URL limits. Founding
// scale is tiny, but chunk defensively so this scales without a rewrite.
const IN_CHUNK = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Export ────────────────────────────────────────────────
export async function exportOrganizationData(): Promise<ActionResult<ExportResult>> {
  const ctx = await getAdminContext();
  if ("error" in ctx) return { success: false, error: ctx.error, code: ctx.code };
  const orgId = ctx.organizationId;

  const schema = await loadLiveSchema();
  const warnings: string[] = [];
  if (!schema.available) {
    warnings.push(
      "Completeness check unavailable: could not read the live database schema. " +
        "Every declared field was requested as-is; verify record counts look right.",
    );
  }

  // ids collected per entity so `via` children can scope to their parent.
  const idsByEntity = new Map<string, string[]>();
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const entity of EXPORT_REGISTRY) {
    try {
      const rows = await fetchEntity(entity, orgId, idsByEntity, schema, warnings);
      data[entity.key] = rows;
      counts[entity.key] = rows.length;

      // Collect this entity's ids for any children that scope through it.
      const idField = entity.idField === undefined ? "id" : entity.idField;
      if (idField) {
        const ids = rows
          .map((r) => (r as Record<string, unknown>)[idField])
          .filter((v): v is string => typeof v === "string");
        idsByEntity.set(entity.key, ids);
      }
    } catch (err) {
      // Never fail the whole export because one entity errored — record it as
      // a warning and continue. An incomplete-but-flagged file beats no file.
      const msg = err instanceof Error ? err.message : String(err);
      data[entity.key] = [];
      counts[entity.key] = 0;
      warnings.push(`Failed to export "${entity.key}" (${entity.table}): ${msg}`);
    }
  }

  // ── Completeness check: org-scoped tables the registry doesn't know about.
  // SOFT warning only — a hard failure could block a church from exporting
  // their data entirely, which is worse than the gap it guards against.
  if (schema.available) {
    const known = knownOrgScopedTables();
    const unregistered = [...schema.orgScopedTables].filter((t) => !known.has(t)).sort();
    if (unregistered.length > 0) {
      warnings.push(
        `Completeness warning: ${unregistered.length} org-scoped table(s) are not in the export registry ` +
          `and were NOT exported: ${unregistered.join(", ")}. If any holds church-owned data, add it to ` +
          `src/lib/export/export-registry.ts (or list it in EXCLUDED_ORG_TABLES with a reason).`,
      );
    }
  }

  // Fetch org identity for the metadata header (also the org_root entity, but
  // read explicitly here so metadata never depends on entity ordering).
  const { data: orgRow } = await supabaseAdmin
    .from("organizations")
    .select("name, slug")
    .eq("id", orgId)
    .maybeSingle();

  const generatedAt = new Date().toISOString();
  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  const exportObject = {
    metadata: {
      format: "atlas-organization-export",
      schema_version: EXPORT_SCHEMA_VERSION,
      generated_at: generatedAt,
      organization: { id: orgId, name: orgRow?.name ?? null, slug: orgRow?.slug ?? null },
      record_counts: counts,
      total_records: totalRecords,
      redactions: EXPORT_REGISTRY.flatMap((e) =>
        (e.redactedFields ?? []).map((r) => ({
          entity: e.key,
          table: e.table,
          field: r.field,
          reason: r.reason,
        })),
      ),
      excluded_tables: EXCLUDED_ORG_TABLES.map((x) => ({ table: x.field, reason: x.reason })),
      warnings,
    },
    data,
  };

  const datePart = generatedAt.slice(0, 10); // YYYY-MM-DD
  const slugPart = (orgRow?.slug ?? "organization").replace(/[^a-z0-9-]/gi, "-");
  const filename = `atlas-export-${slugPart}-${datePart}.json`;

  return {
    success: true,
    data: {
      filename,
      json: JSON.stringify(exportObject, null, 2),
      summary: { totalRecords, entityCount: EXPORT_REGISTRY.length, warnings },
    },
  };
}

// ─── Per-entity fetch (org-scoped by declared strategy) ────────────────────
async function fetchEntity(
  entity: ExportEntity,
  orgId: string,
  idsByEntity: Map<string, string[]>,
  schema: LiveSchema,
  warnings: string[],
): Promise<Record<string, unknown>[]> {
  // Intersect the declared allow-list with columns that actually exist, so a
  // not-yet-applied migration surfaces as a soft warning rather than a crash.
  let selectFields = [...entity.fields];
  if (schema.available) {
    const live = schema.columnsByTable.get(entity.table);
    if (!live) {
      warnings.push(`Table "${entity.table}" (entity "${entity.key}") not found in the live schema — skipped.`);
      return [];
    }
    const missing = entity.fields.filter((f) => !live.has(f));
    if (missing.length > 0) {
      selectFields = entity.fields.filter((f) => live.has(f));
      warnings.push(
        `Entity "${entity.key}": declared field(s) not present in the live schema and omitted: ${missing.join(", ")}.`,
      );
    }
    // Column-coverage: church-owned columns present live but neither exported
    // nor explicitly redacted. Soft warning — the point is no silent gaps.
    const accountedFor = new Set<string>([
      ...entity.fields,
      ...(entity.redactedFields ?? []).map((r) => r.field),
    ]);
    const uncovered = [...live].filter((c) => !accountedFor.has(c));
    if (uncovered.length > 0) {
      warnings.push(
        `Entity "${entity.key}" (${entity.table}): ${uncovered.length} live column(s) neither exported nor redacted: ${uncovered.join(", ")}. ` +
          `Add to fields or redactedFields in the registry.`,
      );
    }
  }
  if (selectFields.length === 0) return [];
  const selectClause = selectFields.join(", ");

  // ── org_root: the organizations row itself, matched on id.
  if (entity.scope.type === "org_root") {
    const { data, error } = await supabaseAdmin
      .from(entity.table)
      .select(selectClause)
      .eq("id", orgId);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Record<string, unknown>[];
  }

  // ── direct: table carries organization_id.
  if (entity.scope.type === "direct") {
    const { data, error } = await supabaseAdmin
      .from(entity.table)
      .select(selectClause)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Record<string, unknown>[];
  }

  // ── via: scope through a parent entity's collected ids.
  const parentIds = idsByEntity.get(entity.scope.parentEntity) ?? [];
  if (parentIds.length === 0) return []; // parent had no rows → no children
  const out: Record<string, unknown>[] = [];
  for (const ids of chunk(parentIds, IN_CHUNK)) {
    const { data, error } = await supabaseAdmin
      .from(entity.table)
      .select(selectClause)
      .in(entity.scope.parentKey, ids);
    if (error) throw new Error(error.message);
    if (data) out.push(...(data as unknown as Record<string, unknown>[]));
  }
  return out;
}
