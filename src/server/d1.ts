import { env } from "cloudflare:workers";
import type { CasePart, GenericPart, GpuPart, PartKind } from "../types";
import {
  fuseSearchRows,
  rowSearchText,
  type CatalogSearchRow
} from "./catalog-search";

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
  "case": "cases",
  "gpu": "gpus",
  "cpu-cooler": "cpu_coolers",
  "fan": "fans",
  "motherboard": "motherboards",
  "psu": "psus",
  "ram": "ram"
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
    throw new Error("D1 binding is unavailable. Configure the DB binding and run the local D1 database.");
  }
  return db;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToCase(row: Record<string, unknown>): CasePart {
  return {
    kind: "case",
    id: String(row.id),
    sourceSheet: String(row.source_sheet ?? ""),
    rowNumber: Number(row.source_row_number ?? 0),
    seller: String(row.seller ?? ""),
    name: String(row.name ?? ""),
    style: String(row.style ?? ""),
    status: String(row.status ?? ""),
    gpuRiser: String(row.gpu_riser ?? ""),
    psu: String(row.psu ?? ""),
    dimensions: {
      lengthMm: nullableNumber(row.length_mm),
      widthMm: nullableNumber(row.width_mm),
      heightMm: nullableNumber(row.height_mm),
      volumeL: nullableNumber(row.volume_l),
      cpuCoolerHeightMm: nullableNumber(row.cpu_cooler_height_mm),
      gpuLengthMm: nullableNumber(row.gpu_length_mm),
      gpuWidthMm: nullableNumber(row.gpu_width_mm),
      gpuThicknessMm: nullableNumber(row.gpu_height_mm),
      pcieSlots: nullableNumber(row.pcie_slots),
      lpPcieSlots: nullableNumber(row.lp_pcie_slots)
    },
    releaseYear: null,
    flags: [],
    raw: {}
  };
}

function rowToGpu(row: Record<string, unknown>): GpuPart {
  return {
    kind: "gpu",
    id: String(row.id),
    sourceSheet: String(row.source_sheet ?? ""),
    rowNumber: Number(row.source_row_number ?? 0),
    chipset: String(row.chipset ?? ""),
    model: String(row.model ?? ""),
    brand: String(row.brand ?? ""),
    name: String(row.name ?? ""),
    lowProfile: booleanish(row.low_profile),
    watercooled: booleanish(row.watercooled),
    pciePins: String(row.pcie_pins ?? ""),
    tdpW: nullableNumber(row.tdp_w),
    dimensions: {
      lengthMm: nullableNumber(row.length_mm),
      widthMm: nullableNumber(row.width_mm),
      thicknessMm: nullableNumber(row.thickness_mm),
      pcieSlots: nullableNumber(row.pcie_bracket)
    },
    releaseYear: null,
    flags: [],
    raw: {}
  };
}

function rowToGenericPart(row: Record<string, unknown>, kind: PartKind): GenericPart {
  const specs: Record<string, string> = {};
  const dimensions: Record<string, number> = {};

  // Copy all non-null values to specs/dimensions for generic access
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || key === "id" || key === "created_at" || key === "updated_at" || key === "status") continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      dimensions[key] = value;
    } else if (typeof value === "string" && value !== "") {
      specs[key] = value;
    } else if (typeof value === "boolean" || value === 0 || value === 1) {
      specs[key] = value ? "Y" : "-";
    }
  }

  return {
    id: String(row.id ?? ""),
    kind,
    sourceSheet: String(row.source_sheet ?? ""),
    rowNumber: Number(row.source_row_number ?? 0),
    brand: String(row.brand ?? ""),
    name: String(row.name ?? row.model ?? ""),
    displayName: (String(row.brand ?? "") + " " + String(row.name ?? row.model ?? "")).trim(),
    status: String(row.status ?? ""),
    sellerUrl: "",
    productUrl: "",
    specs,
    dimensions,
    releaseYear: null,
    flags: [],
    raw: row as Record<string, string>,
    links: {}
  };
}

// ---------------------------------------------------------------------------
// Load parts (cases & GPUs for build view)
// ---------------------------------------------------------------------------

export async function loadParts(event: unknown): Promise<{ cases: CasePart[]; gpus: GpuPart[]; source: "d1" }> {
  void event;
  const db = requireDb();
  const [caseRows, gpuRows] = await Promise.all([
    db.prepare("select * from cases order by name").all<Record<string, unknown>>(),
    db.prepare("select * from gpus order by name").all<Record<string, unknown>>()
  ]);

  return {
    cases: (caseRows.results ?? []).map(rowToCase),
    gpus: (gpuRows.results ?? []).map(rowToGpu),
    source: "d1"
  };
}

export async function findCaseAndGpu(event: unknown, caseId: string, gpuId: string) {
  const parts = await loadParts(event);
  return {
    casePart: parts.cases.find((part) => part.id === caseId) ?? null,
    gpuPart: parts.gpus.find((part) => part.id === gpuId) ?? null,
    source: parts.source
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchCatalog(event: unknown, rawOptions: Partial<CatalogSearchOptions>) {
  return searchCatalogRows(event, rawOptions);
}

async function searchCatalogRows(event: unknown, rawOptions: Partial<CatalogSearchOptions>) {
  void event;
  const options = {
    query: rawOptions.query?.trim() ?? "",
    limit: Math.max(1, Math.min(5000, Math.floor(rawOptions.limit ?? 25))),
    kind: rawOptions.kind && rawOptions.kind !== "all" ? rawOptions.kind : undefined,
    sourceSheet: rawOptions.sourceSheet && rawOptions.sourceSheet !== "all" ? rawOptions.sourceSheet : undefined
  };
  const db = requireDb();

  if (!options.query) {
    return {
      source: "d1" as const,
      suggestions: [] as CatalogSearchSuggestion[]
    };
  }

  // Collect search rows from relevant tables
  const allRows: CatalogSearchRow[] = [];
  const tablesToSearch = options.kind ? [TABLE_MAP[options.kind]].filter(Boolean) : Object.values(TABLE_MAP);

  for (const table of tablesToSearch) {
    const cols = searchColumnsForTable(table);
    const rows = await db.prepare(`select ${cols} from ${table}`).all<CatalogSearchRow>();
    allRows.push(...(rows.results ?? []));
  }

  const suggestions = fuseSearchRows(allRows, options.query, options.limit).map(rowSuggestion);
  return { source: "d1" as const, suggestions };
}

function searchColumnsForTable(table: string): string {
  switch (table) {
    case "cases": return "id, 'case' as kind, seller, name, style, status";
    case "gpus": return "id, 'gpu' as kind, brand, name, chipset, model, status";
    case "cpu_coolers": return "id, 'cpu-cooler' as kind, brand, name, type, status";
    case "fans": return "id, 'fan' as kind, brand, model, status";
    case "motherboards": return "id, 'motherboard' as kind, brand, name, cpu, chipset, socket, status";
    case "psus": return "id, 'psu' as kind, brand, name, form_factor, wattage, status";
    case "ram": return "id, 'ram' as kind, brand, model, memory_type, status";
    default: return "id";
  }
}

function rowSuggestion(row: CatalogSearchRow & { score: number }): CatalogSearchSuggestion {
  const brand = String(row.brand ?? row.seller ?? "");
  const name = String(row.name ?? row.model ?? "");
  return {
    id: String(row.id ?? ""),
    kind: String(row.kind ?? ""),
    displayName: String(row.display_name ?? (brand + " " + name).trim()),
    sourceSheet: String(row.source_sheet ?? ""),
    rowNumber: Number(row.source_row_number ?? 0),
    score: row.score,
    match: rowSearchText(row)
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
      parts: [] as GenericPart[]
    };
  }

  const db = requireDb();
  const allParts: GenericPart[] = [];

  // Try each table — slugs are globally unique
  for (const table of ["cases", "gpus", "cpu_coolers", "fans", "motherboards", "psus", "ram"]) {
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const rows = await db
      .prepare(`select * from ${table} where id in (${placeholders})`)
      .bind(...uniqueIds)
      .all<Record<string, unknown>>();

    for (const row of (rows.results ?? [])) {
      allParts.push(rowToGenericPart(row, tableToKind(table)));
    }
  }

  // Preserve input order
  const partsById = new Map(allParts.map(p => [p.id, p]));
  return {
    source: "d1" as const,
    parts: uniqueIds.map(id => partsById.get(id)).filter((p): p is GenericPart => Boolean(p))
  };
}

function tableToKind(table: string): PartKind {
  const kind = Object.entries(TABLE_MAP).find(([, tbl]) => tbl === table)?.[0];
  return (kind as PartKind) ?? "unknown";
}

export async function loadCatalog(event: unknown, rawOptions: Partial<CatalogQueryOptions> = {}): Promise<{
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
}> {
  const options = clampCatalogOptions(rawOptions);
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
      pagination: { page: 1, pageSize: options.pageSize, pageCount: 0 }
    };
  }

  if (options.search) {
    const searchResults = await searchCatalogRows(event, { query: options.search, kind: options.kind, limit: options.pageSize });
    filteredTotal = searchResults.suggestions.length;
    const pageIds = searchResults.suggestions.slice(offset, offset + options.pageSize).map(s => s.id);
    parts = (await loadCatalogPartsByIds(event, pageIds)).parts;
  } else {
    const { where, values } = buildCatalogWhere(options, table);
    const orderBy = "order by name";
    const rows = await db
      .prepare(`select * from ${table} ${where} ${orderBy} limit ? offset ?`)
      .bind(...values, options.pageSize, offset)
      .all<Record<string, unknown>>();
    parts = (rows.results ?? []).map(row => rowToGenericPart(row, kind));
    const filteredRows = await db
      .prepare(`select count(*) as count from ${table} ${where}`)
      .bind(...values)
      .all<{ count: number }>();
    filteredTotal = Number(filteredRows.results?.[0]?.count ?? 0);
  }

  // Summary: aggregate across all tables
  const byKind: Record<string, number> = {};
  for (const [k, tbl] of Object.entries(TABLE_MAP)) {
    const r = await db.prepare(`select count(*) as count from ${tbl}`).all<{ count: number }>();
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
      pageCount: Math.max(1, Math.ceil(filteredTotal / options.pageSize))
    }
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
    clauses.push("(name like ? escape '\\' or brand like ? escape '\\' or status like ? escape '\\')");
    values.push(like, like, like);
  }

  return { where: clauses.length ? `where ${clauses.join(" and ")}` : "", values };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanish(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function clampCatalogOptions(options: Partial<CatalogQueryOptions> = {}): CatalogQueryOptions {
  return {
    page: Math.max(1, Math.floor(options.page ?? 1)),
    pageSize: Math.max(10, Math.min(5000, Math.floor(options.pageSize ?? 50))),
    kind: options.kind && options.kind !== "all" ? options.kind : undefined,
    sourceSheet: options.sourceSheet && options.sourceSheet !== "all" ? options.sourceSheet : undefined,
    search: options.search?.trim() || undefined
  };
}
