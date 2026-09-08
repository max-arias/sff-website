import { env } from "cloudflare:workers";
import { normalizeSearchText } from "../lib/search-normalization";
import type { CasePart, GenericPart, GpuPart, PartKind } from "../types";
import { decodeCatalogRow } from "./d1-decoders";

interface D1Result<T> {
  results?: T[];
}

interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<D1Result<T>>;
    };
    all<T>(): Promise<D1Result<T>>;
  };
}

export interface CatalogQueryOptions {
  page: number;
  pageSize: number;
  kind?: string;
  sourceSheet?: string;
  search?: string;
}

export interface CatalogSearchOptions {
  query: string;
  limit: number;
  kind?: string;
  sourceSheet?: string;
}

export interface CatalogSearchSuggestion {
  id: string;
  kind: string;
  displayName: string;
  sourceSheet: string;
  rowNumber: number;
  score: number;
  match: string;
}

// ---------------------------------------------------------------------------
// Kind → table mapping
// ---------------------------------------------------------------------------

const TABLE_MAP: Record<string, string> = {
  case: "cases",
  gpu: "gpus",
  "cpu-cooler": "cpu_coolers",
  fan: "fans",
  motherboard: "motherboards",
  psu: "psus",
  ram: "ram",
};

function kindToTable(kind: string): string | null {
  return TABLE_MAP[kind] ?? null;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function getDb() {
  return (env as { DB?: D1DatabaseLike }).DB;
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error(
      "D1 binding is unavailable. Configure the DB binding and run the local D1 database.",
    );
  }
  return db;
}

const CATALOG_CACHE_TTL_SECONDS = 60 * 60;

type CatalogBindings = { CATALOG_CACHE?: KVNamespace };
// Astro's generated cloudflare:workers type does not include custom bindings.
const catalogBindings = env as unknown as CatalogBindings;

/**
 * The catalog is public and changes only through the deployment pipeline.
 * Workers KV is the durable cache layer because this Worker is served from a
 * workers.dev hostname, where zone Cache Rules do not apply.
 */
async function cachedCatalogValue<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cache = catalogBindings.CATALOG_CACHE;
  const cacheKey = `catalog:v2:${key}`;

  if (cache) {
    try {
      const cached = await cache.get<T>(cacheKey, {
        type: "json",
        cacheTtl: CATALOG_CACHE_TTL_SECONDS,
      });
      if (cached !== null) return cached;
    } catch {
      // KV availability must not prevent the catalog from serving from D1.
    }
  }

  const value = await load();

  if (cache) {
    try {
      await cache.put(cacheKey, JSON.stringify(value), {
        expirationTtl: CATALOG_CACHE_TTL_SECONDS,
      });
    } catch {
      // A cache write may fail without affecting the current response.
    }
  }

  return value;
}

// ---------------------------------------------------------------------------
// Load parts (cases & GPUs for build view)
// ---------------------------------------------------------------------------

export async function loadParts(
  event: unknown,
): Promise<{ cases: CasePart[]; gpus: GpuPart[]; source: "d1" }> {
  void event;
  const parts = await cachedCatalogValue("v1/build-parts", async () => {
    const db = requireDb();
    const [caseRows, gpuRows] = await Promise.all([
      db
        .prepare("select * from cases order by name")
        .all<Record<string, unknown>>(),
      db
        .prepare("select * from gpus order by name")
        .all<Record<string, unknown>>(),
    ]);

    return {
      cases: (caseRows.results ?? []).map(
        (row) => decodeCatalogRow(row, "case") as CasePart,
      ),
      gpus: (gpuRows.results ?? []).map(
        (row) => decodeCatalogRow(row, "gpu") as GpuPart,
      ),
    };
  });

  return { ...parts, source: "d1" };
}

export async function findCaseAndGpu(
  event: unknown,
  caseId: string,
  gpuId: string,
) {
  void event;
  const db = requireDb();
  const [caseRows, gpuRows] = await Promise.all([
    db.prepare("select * from cases where id = ? limit 1").bind(caseId).all<Record<string, unknown>>(),
    db.prepare("select * from gpus where id = ? limit 1").bind(gpuId).all<Record<string, unknown>>(),
  ]);

  return {
    casePart: caseRows.results?.[0]
      ? (decodeCatalogRow(caseRows.results[0], "case") as CasePart)
      : null,
    gpuPart: gpuRows.results?.[0]
      ? (decodeCatalogRow(gpuRows.results[0], "gpu") as GpuPart)
      : null,
    source: "d1" as const,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchCatalog(
  event: unknown,
  rawOptions: Partial<CatalogSearchOptions>,
) {
  void event;
  const options = {
    query: normalizeSearchText(rawOptions.query?.trim() ?? ""),
    limit: Math.max(1, Math.min(100, Math.floor(rawOptions.limit ?? 25))),
    kind:
      rawOptions.kind && rawOptions.kind !== "all"
        ? rawOptions.kind
        : undefined,
  };

  if (options.query.length < 3) {
    return {
      source: "d1" as const,
      suggestions: [] as CatalogSearchSuggestion[],
    };
  }

  const db = requireDb();
  const values: unknown[] = [`%${options.query}%`];
  const kindClause = options.kind ? "and kind = ?" : "";
  if (options.kind) values.push(options.kind);
  values.push(options.query, `${options.query}%`, options.limit);

  const rows = await db
    .prepare(
      `select id, kind, display_name, normalized_search_text
       from catalog_search
       where normalized_search_text like ? ${kindClause}
       order by
         case
           when normalized_search_text = ? then 0
           when normalized_search_text like ? then 1
           else 2
         end,
         display_name collate nocase
       limit ?`,
    )
    .bind(...values)
    .all<{
      id: string;
      kind: string;
      display_name: string;
      normalized_search_text: string;
    }>();

  const results = rows.results ?? [];
  return {
    source: "d1" as const,
    suggestions: results.map((row, index) => ({
      id: row.id,
      kind: row.kind,
      displayName: row.display_name,
      sourceSheet: "",
      rowNumber: 0,
      score: results.length - index,
      match: row.normalized_search_text,
    })),
  };
}

// ---------------------------------------------------------------------------
// Load catalog (paginated, filtered)
// ---------------------------------------------------------------------------

export async function loadCatalogPartsByIds(event: unknown, ids: string[]) {
  void event;
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) {
    return {
      source: "d1" as const,
      parts: [] as GenericPart[],
    };
  }

  const db = requireDb();
  const allParts: GenericPart[] = [];

  // Try each table — slugs are globally unique
  for (const table of [
    "cases",
    "gpus",
    "cpu_coolers",
    "fans",
    "motherboards",
    "psus",
    "ram",
  ]) {
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const rows = await db
      .prepare(`select * from ${table} where id in (${placeholders})`)
      .bind(...uniqueIds)
      .all<Record<string, unknown>>();

    for (const row of rows.results ?? []) {
      allParts.push(decodeCatalogRow(row, tableToKind(table)) as GenericPart);
    }
  }

  // Preserve input order
  const partsById = new Map(allParts.map((p) => [p.id, p]));
  return {
    source: "d1" as const,
    parts: uniqueIds
      .map((id) => partsById.get(id))
      .filter((p): p is GenericPart => Boolean(p)),
  };
}

function tableToKind(table: string): PartKind {
  const kind = Object.entries(TABLE_MAP).find(([, tbl]) => tbl === table)?.[0];
  return (kind as PartKind) ?? "unknown";
}

type CatalogResult = {
  parts: GenericPart[];
  source: "d1";
  summary: {
    total: number;
    filteredTotal: number;
    byKind: Record<string, number>;
    bySourceSheet: Record<string, number>;
  };
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
  };
};

export function loadCatalog(
  event: unknown,
  rawOptions: Partial<CatalogQueryOptions> = {},
): Promise<CatalogResult> {
  const options = clampCatalogOptions(rawOptions);
  if (options.search) return loadCatalogUncached(event, options);

  return cachedCatalogValue(
    `v1/catalog/${encodeURIComponent(JSON.stringify(options))}`,
    () => loadCatalogUncached(event, options),
  );
}

async function loadCatalogUncached(
  event: unknown,
  options: CatalogQueryOptions,
): Promise<CatalogResult> {
  const db = requireDb();
  const offset = (options.page - 1) * options.pageSize;
  let parts: GenericPart[] = [];
  let filteredTotal = 0;
  const kind = (options.kind || "case") as PartKind;
  const table = kindToTable(kind);

  if (!table) {
    // Unknown kind — return empty
    return {
      parts,
      source: "d1",
      summary: { total: 0, filteredTotal: 0, byKind: {}, bySourceSheet: {} },
      pagination: { page: 1, pageSize: options.pageSize, pageCount: 0 },
    };
  }

  if (options.search) {
    const searchResults = await searchCatalog(event, {
      query: options.search,
      kind: options.kind,
      limit: options.pageSize,
    });
    filteredTotal = searchResults.suggestions.length;
    const pageIds = searchResults.suggestions
      .slice(offset, offset + options.pageSize)
      .map((s) => s.id);
    parts = (await loadCatalogPartsByIds(event, pageIds)).parts;
  } else {
    const { where, values } = buildCatalogWhere(options, table);
    const orderBy = "order by name";
    const rows = await db
      .prepare(`select * from ${table} ${where} ${orderBy} limit ? offset ?`)
      .bind(...values, options.pageSize, offset)
      .all<Record<string, unknown>>();
    parts = (rows.results ?? []).map((row) => decodeCatalogRow(row, kind) as GenericPart);
    const filteredRows = await db
      .prepare(`select count(*) as count from ${table} ${where}`)
      .bind(...values)
      .all<{ count: number }>();
    filteredTotal = Number(filteredRows.results?.[0]?.count ?? 0);
  }

  // Summary: aggregate across all tables
  const byKind: Record<string, number> = {};
  for (const [k, tbl] of Object.entries(TABLE_MAP)) {
    const r = await db
      .prepare(`select count(*) as count from ${tbl}`)
      .all<{ count: number }>();
    byKind[k] = Number(r.results?.[0]?.count ?? 0);
  }
  const total = Object.values(byKind).reduce((a, b) => a + b, 0);

  return {
    parts,
    source: "d1",
    summary: { total, filteredTotal, byKind, bySourceSheet: {} },
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      pageCount: Math.max(1, Math.ceil(filteredTotal / options.pageSize)),
    },
  };
}

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

function buildCatalogWhere(options: CatalogQueryOptions, _table: string) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (options.search) {
    const like = `%${options.search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    clauses.push(
      "(name like ? escape '\\' or brand like ? escape '\\' or status like ? escape '\\')",
    );
    values.push(like, like, like);
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    values,
  };
}

function clampCatalogOptions(
  options: Partial<CatalogQueryOptions> = {},
): CatalogQueryOptions {
  return {
    page: Math.max(1, Math.floor(options.page ?? 1)),
    pageSize: Math.max(10, Math.min(5000, Math.floor(options.pageSize ?? 50))),
    kind: options.kind && options.kind !== "all" ? options.kind : undefined,
    sourceSheet:
      options.sourceSheet && options.sourceSheet !== "all"
        ? options.sourceSheet
        : undefined,
    search: options.search?.trim() || undefined,
  };
}
