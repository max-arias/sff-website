import { env } from "cloudflare:workers";
import type { CasePart, SelectableKind, SelectablePartByKind } from "../types";
import { normalizeSearchText } from "../lib/search-normalization";
import { decodeSelectable, SELECTABLE_TABLES, type D1Row } from "./d1-decoders";
import {
  NUMERIC_COLUMNS_BY_KIND,
  numericColumn,
  SORT_COLUMNS_BY_KIND,
  SPARSE_COLUMNS,
} from "./query-policy";
import type { SemanticSort } from "./query-policy";
import type { ReadOnlyDatabase } from "./selected-part-repository";

const PAGE_SIZE = 25;
type Direction = "asc" | "desc";
type NumericFilters = Partial<Record<string, number>>;
type PsuFormFactor = "sfx" | "sfx-l" | "flex-atx" | "atx" | "tfx" | "1u";
type PsuFeature = "atx-3" | "12vhpwr" | "fully-modular" | "semi-passive";

export interface CandidatePageRequest {
  kind: SelectableKind;
  page: number;
  search?: string;
  sort?: { key: SemanticSort; direction: Direction };
  showSparseRows?: boolean;
  numericFilters?: NumericFilters;
  gpuBrand?: string | null;
  caseVolumeTier?: "sub-10l" | "10l-20l" | "over-20l" | null;
  caseIntent?: "steam-machine" | null;
  psuTier?: "a-or-better" | "b-or-better" | "c-or-better" | null;
  psuFormFactor?: PsuFormFactor | null;
  psuFeatures?: readonly PsuFeature[];
  selectedCase?: CasePart | null;
}

export interface CandidateFilterMetadata {
  numericMaxima: Record<string, number | null>;
  options: Record<string, string[]>;
}

export interface CandidatePage<K extends SelectableKind = SelectableKind> {
  records: SelectablePartByKind[K][];
  filteredTotal: number;
  page: number;
  pageSize: 25;
  metadata: CandidateFilterMetadata;
}

function database(): ReadOnlyDatabase {
  const db = (env as { DB?: ReadOnlyDatabase }).DB;
  if (!db) throw new Error("D1 binding is unavailable.");
  return db;
}

function titleColumn(kind: SelectableKind) {
  return kind === "ram" ? "model" : "name";
}

function addNumericFilters(clauses: string[], values: unknown[], request: CandidatePageRequest) {
  for (const [filter, value] of Object.entries(request.numericFilters ?? {})) {
    if (!Number.isFinite(value)) continue;
    const column = numericColumn(request.kind, filter);
    if (!column) continue;
    clauses.push(`${column} is not null and ${column} <= ?`);
    values.push(value);
  }
}

function addSparseClause(clauses: string[], request: CandidatePageRequest) {
  if (request.showSparseRows) return;
  clauses.push(`(${SPARSE_COLUMNS[request.kind].map((column) => `${column} is not null and (${column} != '' or typeof ${column} = 'real')`).join(" or ")})`);
}

function addDiscreteFilters(clauses: string[], values: unknown[], request: CandidatePageRequest) {
  if (request.kind === "gpu" && request.gpuBrand?.trim()) {
    clauses.push("lower(brand) = lower(?)"); values.push(request.gpuBrand.trim());
  }
  if (request.kind === "case" && request.caseVolumeTier) {
    const ranges = { "sub-10l": [0, 10], "10l-20l": [10, 20], "over-20l": [20, null] } as const;
    const [min, max] = ranges[request.caseVolumeTier];
    clauses.push(max === null ? "volume_l > ?" : "volume_l >= ? and volume_l < ?");
    values.push(min); if (max !== null) values.push(max);
  }
  if (request.kind === "case" && request.caseIntent === "steam-machine") {
    clauses.push("volume_l is not null and volume_l >= 3 and volume_l <= 6");
    clauses.push("length_mm is not null and width_mm is not null and height_mm is not null");
    clauses.push("max(length_mm, width_mm, height_mm) <= 220");
    clauses.push("max(length_mm, width_mm, height_mm) / min(length_mm, width_mm, height_mm) <= 1.45");
  }
  if (request.kind !== "psu") return;
  if (request.psuTier) {
    const max = { "a-or-better": 0.2, "b-or-better": 1.2, "c-or-better": 2.2 }[request.psuTier];
    clauses.push("psu_tier_rank is not null and psu_tier_rank <= ?"); values.push(max);
  }
  if (request.psuFormFactor) {
    clauses.push("('/' || replace(replace(replace(lower(form_factor), '-', ''), ' ', ''), ',', '/') || '/') like '%/' || ? || '/%'");
    values.push(request.psuFormFactor.replaceAll("-", "").replaceAll(" ", "").toLowerCase());
  }
  for (const feature of request.psuFeatures ?? []) {
    if (feature === "atx-3") clauses.push("atx_3_compatible = 1");
    else if (feature === "12vhpwr") clauses.push("cable_12vhpwr_count is not null and cable_12vhpwr_count > 0");
    else if (feature === "semi-passive") clauses.push("semi_passive = 1");
    else if (feature === "fully-modular") clauses.push("(lower(modular) like '%fully%' or lower(modular) like '%full%' or lower(modular) like '%modular%')");
  }
}

function addCaseEnvelope(clauses: string[], values: unknown[], request: CandidatePageRequest) {
  const envelope = request.selectedCase;
  if (request.kind !== "gpu" || !envelope) return;
  const limits: Array<[string, number | null]> = [
    ["length_mm", envelope.dimensions.gpuLengthMm],
    ["width_mm", envelope.dimensions.gpuWidthMm],
    ["thickness_mm", envelope.dimensions.gpuThicknessMm],
    ["pcie_bracket", envelope.dimensions.pcieSlots],
  ];
  for (const [column, limit] of limits) {
    if (limit !== null) { clauses.push(`(${column} is null or ${column} <= ?)`); values.push(limit); }
  }
  if (envelope.dimensions.lpPcieSlots !== null && envelope.dimensions.pcieSlots === 0) {
    clauses.push("low_profile = 1");
  }
}

function whereParts(request: CandidatePageRequest) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const search = normalizeSearchText(request.search ?? "");
  if (search) { clauses.push("normalized_search_text like ?"); values.push(`%${search}%`); }
  addSparseClause(clauses, request);
  addNumericFilters(clauses, values, request);
  addDiscreteFilters(clauses, values, request);
  addCaseEnvelope(clauses, values, request);
  return { where: clauses.length ? `where ${clauses.join(" and ")}` : "", values, search };
}

function orderBy(request: CandidatePageRequest, search: string): { sql: string; values: unknown[] } {
  const title = titleColumn(request.kind);
  const base = `availability_status = 'available' desc, lower(${title}) asc, id asc`;
  const explicit = request.sort && SORT_COLUMNS_BY_KIND[request.kind][request.sort.key];
  if (explicit) return { sql: `(${explicit} is null) asc, ${explicit} ${request.sort!.direction}, ${base}`, values: [] };
  if (search) return { sql: `case when normalized_search_text = ? then 0 when normalized_search_text like ? then 1 else 2 end asc, ${base}`, values: [search, `%${search}%`] };
  return { sql: base, values: [] };
}

function metadataOptions(kind: SelectableKind): Record<string, string[]> {
  return kind === "gpu"
    ? { "gpu-brand": [] }
    : kind === "psu"
      ? { "psu-tier": ["a-or-better", "b-or-better", "c-or-better"], "psu-form": ["sfx", "sfx-l", "flex-atx", "atx", "tfx", "1u"], "psu-feature": ["atx-3", "12vhpwr", "fully-modular", "semi-passive"] }
      : kind === "case" ? { "case-volume": ["sub-10l", "10l-20l", "over-20l"], "case-intent": ["steam-machine"] } : {};
}

export class D1CandidatePageRepository {
  constructor(private readonly db: ReadOnlyDatabase = database()) {}

  async getPage<K extends SelectableKind>(request: CandidatePageRequest & { kind: K }): Promise<CandidatePage<K>> {
    const table = SELECTABLE_TABLES[request.kind];
    const { where, values, search } = whereParts(request);
    const order = orderBy(request, search);
    const offset = Math.max(0, Math.floor(request.page - 1)) * PAGE_SIZE;
    const columns = `*`;
    const [rows, count, numeric, brands] = await Promise.all([
      this.db.prepare(`select ${columns} from ${table} ${where} order by ${order.sql} limit ? offset ?`).bind(...values, ...order.values, PAGE_SIZE, offset).all<D1Row>(),
      this.db.prepare(`select count(*) as count from ${table} ${where}`).bind(...values).all<{ count: number }>(),
      this.numericMetadata(table, request.kind),
      request.kind === "gpu" ? this.db.prepare(`select distinct brand from ${table} where brand is not null and trim(brand) != '' order by lower(brand), brand`).all<{ brand: string }>() : Promise.resolve({ results: [] as { brand: string }[] }),
    ]);
    const options = metadataOptions(request.kind);
    if (request.kind === "gpu") options["gpu-brand"] = (brands.results ?? []).map((row) => row.brand);
    return { records: (rows.results ?? []).map((row) => decodeSelectable(request.kind, row)), filteredTotal: Number(count.results?.[0]?.count ?? 0), page: Math.max(1, Math.floor(request.page)), pageSize: 25, metadata: { numericMaxima: numeric, options } };
  }

  private async numericMetadata(table: string, kind: SelectableKind): Promise<Record<string, number | null>> {
    const columns = [...new Set(Object.values(NUMERIC_COLUMNS_BY_KIND[kind]))];
    const select = columns.map((column) => `max(${column}) as max_${column}`).join(", ");
    const row = (await this.db.prepare(`select ${select} from ${table}`).all<Record<string, unknown>>()).results?.[0] ?? {};
    const result: Record<string, number | null> = {};
    for (const [filter, column] of Object.entries(NUMERIC_COLUMNS_BY_KIND[kind])) result[filter] = row[`max_${column}`] == null ? null : Number(row[`max_${column}`]);
    return result;
  }
}
