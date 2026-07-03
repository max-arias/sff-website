import { env } from "cloudflare:workers";
import type { CasePart, GenericPart, GpuPart, PartKind } from "../types";

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

interface CatalogSearchRow {
  id: string;
  kind: string;
  source_sheet: string;
  source_row_number: number;
  brand: string;
  name: string;
  display_name: string;
  status: string;
  gpu_chipset: string;
  gpu_model: string;
  case_seller: string;
  case_style: string;
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

export async function loadParts(event: unknown): Promise<{ cases: CasePart[]; gpus: GpuPart[]; source: "d1" }> {
  void event;
  const db = requireDb();
  const rows = await db
    .prepare("select * from sff_parts where kind in ('case', 'gpu') order by kind, display_name")
    .all<Record<string, unknown>>();
  const parts = rows.results ?? [];

  return {
    cases: parts.filter((row) => row.kind === "case").map(rowToCase),
    gpus: parts.filter((row) => row.kind === "gpu").map(rowToGpu),
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

export async function searchCatalog(event: unknown, rawOptions: Partial<CatalogSearchOptions>) {
  return searchCatalogRows(event, rawOptions);
}

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
  const rows = await db
    .prepare(`select * from sff_parts where id in (${uniqueIds.map(() => "?").join(", ")})`)
    .bind(...uniqueIds)
    .all<Record<string, unknown>>();

  const partsById = new Map((rows.results ?? []).map((row) => [String(row.id), rowToGenericPart(row)]));

  return {
    source: "d1" as const,
    parts: uniqueIds.map((id) => partsById.get(id)).filter((part): part is GenericPart => Boolean(part))
  };
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

  if (options.search) {
    const searchIds = (await searchCatalogRows(event, {
      query: options.search,
      kind: options.kind,
      sourceSheet: options.sourceSheet,
      limit: options.pageSize
    })).suggestions.map((suggestion) => suggestion.id);
    filteredTotal = searchIds.length;
    const pageIds = searchIds.slice(offset, offset + options.pageSize);

    if (pageIds.length) {
      const rows = await db
        .prepare(`select * from sff_parts where id in (${pageIds.map(() => "?").join(", ")})`)
        .bind(...pageIds)
        .all<Record<string, unknown>>();
      const rowsById = new Map((rows.results ?? []).map((row) => [String(row.id), rowToGenericPart(row)]));
      parts = pageIds.map((id) => rowsById.get(id)).filter((part): part is GenericPart => Boolean(part));
    }
  } else {
    const { where, values } = buildCatalogWhere(options);
    const orderBy = options.kind === "psu"
      ? "order by case when psu_tier_rank is null then 99 else psu_tier_rank end, display_name"
      : "order by kind, display_name";
    const rows = await db
      .prepare(`select * from sff_parts ${where} ${orderBy} limit ? offset ?`)
      .bind(...values, options.pageSize, offset)
      .all<Record<string, unknown>>();
    parts = (rows.results ?? []).map(rowToGenericPart);
    const filteredRows = await db
      .prepare(`select count(*) as count from sff_parts ${where}`)
      .bind(...values)
      .all<{ count: number }>();
    filteredTotal = Number(filteredRows.results?.[0]?.count ?? 0);
  }

  const totalRows = await db.prepare("select count(*) as count from sff_parts").all<{ count: number }>();
  const byKindRows = await db
    .prepare("select kind, count(*) as count from sff_parts group by kind order by count desc")
    .all<{ kind: string; count: number }>();
  const bySourceRows = await db
    .prepare("select source_sheet, count(*) as count from sff_parts group by source_sheet order by count desc")
    .all<{ source_sheet: string; count: number }>();
  const total = Number(totalRows.results?.[0]?.count ?? 0);

  return {
    parts,
    source: "d1",
    summary: {
      total,
      filteredTotal,
      byKind: Object.fromEntries((byKindRows.results ?? []).map((row) => [row.kind, Number(row.count)])),
      bySourceSheet: Object.fromEntries((bySourceRows.results ?? []).map((row) => [row.source_sheet, Number(row.count)]))
    },
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      pageCount: Math.max(1, Math.ceil(filteredTotal / options.pageSize))
    }
  };
}

function rowToCase(row: Record<string, unknown>): CasePart {
  return {
    kind: "case",
    id: String(row.id),
    sourceSheet: String(row.source_sheet),
    rowNumber: Number(row.source_row_number ?? row.row_number),
    seller: String(row.case_seller ?? row.seller ?? row.brand ?? ""),
    name: String(row.name ?? ""),
    style: String(row.case_style ?? row.style ?? ""),
    status: String(row.status ?? ""),
    gpuRiser: String(row.case_gpu_riser ?? row.gpu_riser ?? ""),
    psu: String(row.case_psu ?? row.psu ?? ""),
    dimensions: {
      lengthMm: nullableNumber(row.length_mm ?? row.case_length_mm),
      widthMm: nullableNumber(row.width_mm ?? row.case_width_mm),
      heightMm: nullableNumber(row.height_mm ?? row.case_height_mm),
      volumeL: nullableNumber(row.volume_l),
      cpuCoolerHeightMm: nullableNumber(row.case_cpu_cooler_height_mm ?? row.cpu_cooler_height_mm),
      gpuLengthMm: nullableNumber(row.case_gpu_length_mm ?? row.gpu_length_mm),
      gpuWidthMm: nullableNumber(row.case_gpu_width_mm ?? row.gpu_width_mm),
      gpuThicknessMm: nullableNumber(row.case_gpu_thickness_mm ?? row.gpu_thickness_mm),
      pcieSlots: nullableNumber(row.case_pcie_slots ?? row.pcie_slots),
      lpPcieSlots: nullableNumber(row.case_lp_pcie_slots ?? row.lp_pcie_slots)
    },
    flags: JSON.parse(String(row.flags_json ?? "[]")) as string[],
    raw: JSON.parse(String(row.raw_json ?? "{}")) as Record<string, string>
  };
}

function rowToGpu(row: Record<string, unknown>): GpuPart {
  return {
    kind: "gpu",
    id: String(row.id),
    sourceSheet: String(row.source_sheet),
    rowNumber: Number(row.source_row_number ?? row.row_number),
    chipset: String(row.gpu_chipset ?? row.chipset ?? ""),
    model: String(row.gpu_model ?? row.model ?? ""),
    brand: String(row.gpu_brand ?? row.brand ?? ""),
    name: String(row.gpu_name ?? row.name ?? ""),
    lowProfile: booleanish(row.gpu_low_profile ?? row.low_profile),
    watercooled: booleanish(row.gpu_watercooled ?? row.watercooled),
    pciePins: String(row.gpu_pcie_pins ?? row.pcie_pins ?? ""),
    tdpW: nullableNumber(row.gpu_tdp_w ?? row.tdp_w),
    dimensions: {
      lengthMm: nullableNumber(row.length_mm),
      widthMm: nullableNumber(row.width_mm),
      thicknessMm: nullableNumber(row.thickness_mm),
      pcieSlots: nullableNumber(row.gpu_pcie_slots ?? row.pcie_slots)
    },
    flags: JSON.parse(String(row.flags_json ?? "[]")) as string[],
    raw: JSON.parse(String(row.raw_json ?? "{}")) as Record<string, string>
  };
}

function rowToGenericPart(row: Record<string, unknown>): GenericPart {
  const specs = JSON.parse(String(row.specs_json ?? "{}")) as Record<string, string>;
  const dimensions = JSON.parse(String(row.dimensions_json ?? "{}")) as Record<string, number>;
  const kind = String(row.kind ?? "unknown") as PartKind;
  const psuFormFactor = String(row.psu_form_factor ?? "").trim();
  const psuTier = String(row.psu_tier ?? "").trim();
  const psuTierSourceUrl = String(row.psu_tier_source_url ?? "").trim();
  const psuTierSourceSheet = String(row.psu_tier_source_sheet ?? "").trim();
  const psuTierNotes = String(row.psu_tier_notes ?? "").trim();
  const motherboardFormFactor = String(row.motherboard_form_factor ?? "").trim();

  mergeNumber(dimensions, "cooler_height", row.cooler_height_mm);
  mergeNumber(dimensions, "wattage", row.psu_wattage);
  mergeNumber(dimensions, "ram_height", row.ram_height_mm);
  mergeNumber(dimensions, "height_incl_contact_pins", row.ram_height_mm);
  mergeNumber(dimensions, "fan_size", row.fan_size_mm);

  if (psuFormFactor && !specs.form_factor) specs.form_factor = psuFormFactor;
  if (psuTier) specs.psu_tier = psuTier;
  if (row.psu_tier_rank !== null && row.psu_tier_rank !== undefined && row.psu_tier_rank !== "") specs.psu_tier_rank = String(row.psu_tier_rank);
  if (psuTierSourceUrl) specs.psu_tier_source_url = psuTierSourceUrl;
  if (psuTierSourceSheet) specs.psu_tier_source_sheet = psuTierSourceSheet;
  if (row.psu_tier_source_row_number !== null && row.psu_tier_source_row_number !== undefined && row.psu_tier_source_row_number !== "") {
    specs.psu_tier_source_row_number = String(row.psu_tier_source_row_number);
  }
  if (psuTierNotes) specs.psu_tier_notes = psuTierNotes;
  if (motherboardFormFactor && !specs.form_factor) specs.form_factor = motherboardFormFactor;

  return {
    id: String(row.id),
    kind,
    sourceSheet: String(row.source_sheet),
    rowNumber: Number(row.source_row_number ?? row.row_number),
    brand: String(row.brand ?? ""),
    name: String(row.name ?? ""),
    displayName: String(row.display_name ?? ""),
    status: String(row.status ?? ""),
    sellerUrl: String(row.seller_url ?? ""),
    productUrl: String(row.product_url ?? ""),
    specs,
    dimensions,
    flags: JSON.parse(String(row.flags_json ?? "[]")) as string[],
    raw: JSON.parse(String(row.raw_json ?? "{}")) as Record<string, string>,
    links: JSON.parse(String(row.links_json ?? "{}")) as Record<string, string>
  };
}

function mergeNumber(target: Record<string, number>, key: string, value: unknown) {
  const number = nullableNumber(value);
  if (number !== null && target[key] === undefined) target[key] = number;
}

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

function rowSearchText(row: CatalogSearchRow) {
  return [
    row.display_name,
    row.brand,
    row.name,
    row.kind,
    row.source_sheet,
    row.status,
    row.gpu_chipset,
    row.gpu_model,
    row.case_seller,
    row.case_style
  ].join(" ");
}

function fuzzyScore(text: string, query: string) {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase().trim();
  if (!needle) return 0;
  if (haystack === needle) return 1000;
  if (haystack.startsWith(needle)) return 900 - Math.min(100, haystack.length - needle.length);
  if (haystack.includes(needle)) return 760 - Math.min(160, haystack.indexOf(needle));

  const terms = needle.split(/\s+/).filter(Boolean);
  const matchedTerms = terms.filter((term) => haystack.includes(term));
  if (matchedTerms.length === terms.length) {
    return 520 + matchedTerms.length * 80;
  }

  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  const typoMatches = terms.filter((term) => {
    const maxDistance = term.length <= 4 ? 1 : Math.max(1, Math.floor(term.length * 0.25));
    return words.some((word) => {
      const prefix = word.slice(0, term.length);
      return levenshteinDistance(prefix, term) <= maxDistance;
    });
  });
  if (typoMatches.length === terms.length) {
    return 430 + typoMatches.length * 60;
  }

  const compactNeedle = needle.replace(/\s+/g, "");
  if (compactNeedle.length > 3) return 0;

  let cursor = 0;
  let streak = 0;
  let matchedChars = 0;
  let score = 180;

  for (const char of compactNeedle) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return 0;
    matchedChars += 1;
    score += 12;
    if (index === cursor) {
      streak += 1;
      score += streak * 4;
    } else {
      streak = 0;
    }
    cursor = index + 1;
  }

  return matchedChars === compactNeedle.length ? score : 0;
}

function levenshteinDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length] ?? 0;
}

function sortSearchMatches<T>(items: T[], query: string, textFor: (item: T) => string, limit?: number) {
  const ranked = items
    .map((item) => ({ item, score: fuzzyScore(textFor(item), query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return (limit ? ranked.slice(0, limit) : ranked).map((entry) => ({ ...entry.item, score: entry.score }));
}

function rowSuggestion(row: CatalogSearchRow & { score: number }): CatalogSearchSuggestion {
  const gpuTitle = [row.brand, row.name].filter(Boolean).join(" ").trim();
  const caseTitle = [row.case_seller, row.name || row.display_name, row.case_style].filter(Boolean).join(" ").trim();

  return {
    id: String(row.id),
    kind: String(row.kind),
    displayName: row.kind === "gpu"
      ? [gpuTitle, row.gpu_model].filter(Boolean).join(" · ")
      : caseTitle || String(row.display_name),
    sourceSheet: String(row.source_sheet),
    rowNumber: Number(row.source_row_number),
    score: row.score,
    match: rowSearchText(row)
  };
}

function buildCatalogWhere(options: CatalogQueryOptions) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (options.kind) {
    clauses.push("kind = ?");
    values.push(options.kind);
  }

  if (options.sourceSheet) {
    clauses.push("source_sheet = ?");
    values.push(options.sourceSheet);
  }

  if (options.search) {
    const like = `%${options.search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    clauses.push(
      "(display_name like ? escape '\\' or brand like ? escape '\\' or name like ? escape '\\' or kind like ? escape '\\' or source_sheet like ? escape '\\' or status like ? escape '\\')"
    );
    values.push(like, like, like, like, like, like);
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    values
  };
}

function buildCatalogFilterWhere(options: Pick<CatalogQueryOptions, "kind" | "sourceSheet">) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (options.kind) {
    clauses.push("kind = ?");
    values.push(options.kind);
  }

  if (options.sourceSheet) {
    clauses.push("source_sheet = ?");
    values.push(options.sourceSheet);
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    values
  };
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

  const { where, values } = buildCatalogFilterWhere(options);
  const rows = await db
    .prepare(
      `select id, kind, source_sheet, source_row_number, brand, name, display_name, status, gpu_chipset, gpu_model, case_seller, case_style from sff_parts ${where}`
    )
    .bind(...values)
    .all<CatalogSearchRow>();
  const suggestions = sortSearchMatches(rows.results ?? [], options.query, rowSearchText, options.limit).map(rowSuggestion);

  return {
    source: "d1" as const,
    suggestions
  };
}
