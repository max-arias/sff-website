import type { CasePart, GenericPart, GpuPart } from "../../app/types";
import { readSnapshot, rowToCase, rowToGenericPart, rowToGpu } from "./snapshot";

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

interface CloudflareEventContext {
  context?: {
    cloudflare?: {
      env?: {
        DB?: D1DatabaseLike;
      };
    };
  };
  cloudflare?: {
    env?: {
      DB?: D1DatabaseLike;
    };
  };
}

function getDb(event: unknown) {
  const cloudflareEvent = event as CloudflareEventContext;
  return cloudflareEvent.context?.cloudflare?.env?.DB ?? cloudflareEvent.cloudflare?.env?.DB;
}

export async function loadParts(event: unknown): Promise<{ cases: CasePart[]; gpus: GpuPart[]; source: "d1" | "snapshot" }> {
  const db = getDb(event);

  if (!db) {
    const snapshot = await readSnapshot();
    return { cases: snapshot.cases, gpus: snapshot.gpus, source: "snapshot" };
  }

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

function summarizeParts(parts: GenericPart[]) {
  const byKind: Record<string, number> = {};
  const bySourceSheet: Record<string, number> = {};

  for (const part of parts) {
    byKind[part.kind] = (byKind[part.kind] ?? 0) + 1;
    bySourceSheet[part.sourceSheet] = (bySourceSheet[part.sourceSheet] ?? 0) + 1;
  }

  return {
    total: parts.length,
    byKind,
    bySourceSheet
  };
}

function clampCatalogOptions(options: Partial<CatalogQueryOptions> = {}): CatalogQueryOptions {
  return {
    page: Math.max(1, Math.floor(options.page ?? 1)),
    pageSize: Math.max(10, Math.min(100, Math.floor(options.pageSize ?? 50))),
    kind: options.kind && options.kind !== "all" ? options.kind : undefined,
    sourceSheet: options.sourceSheet && options.sourceSheet !== "all" ? options.sourceSheet : undefined,
    search: options.search?.trim() || undefined
  };
}

function filterSnapshotParts(parts: GenericPart[], options: CatalogQueryOptions) {
  const search = options.search?.toLowerCase();

  return parts.filter((part) => {
    if (options.kind && part.kind !== options.kind) return false;
    if (options.sourceSheet && part.sourceSheet !== options.sourceSheet) return false;
    if (!search) return true;

    return [part.displayName, part.brand, part.name, part.kind, part.sourceSheet, part.status]
      .some((value) => value.toLowerCase().includes(search));
  });
}

function partSearchText(part: Pick<GenericPart, "displayName" | "brand" | "name" | "kind" | "sourceSheet" | "status">) {
  return [part.displayName, part.brand, part.name, part.kind, part.sourceSheet, part.status].join(" ");
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

function snapshotSuggestion(part: GenericPart & { score: number }): CatalogSearchSuggestion {
  return {
    id: part.id,
    kind: part.kind,
    displayName: part.displayName,
    sourceSheet: part.sourceSheet,
    rowNumber: part.rowNumber,
    score: part.score,
    match: partSearchText(part)
  };
}

function rowSuggestion(row: CatalogSearchRow & { score: number }): CatalogSearchSuggestion {
  return {
    id: String(row.id),
    kind: String(row.kind),
    displayName: String(row.display_name),
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
  const options = {
    query: rawOptions.query?.trim() ?? "",
    limit: Math.max(1, Math.min(1000, Math.floor(rawOptions.limit ?? 25))),
    kind: rawOptions.kind && rawOptions.kind !== "all" ? rawOptions.kind : undefined,
    sourceSheet: rawOptions.sourceSheet && rawOptions.sourceSheet !== "all" ? rawOptions.sourceSheet : undefined
  };
  const db = getDb(event);

  if (!options.query) {
    return {
      source: db ? "d1" as const : "snapshot" as const,
      suggestions: [] as CatalogSearchSuggestion[]
    };
  }

  if (!db) {
    const snapshot = await readSnapshot();
    const filtered = snapshot.parts.filter((part) => {
      if (options.kind && part.kind !== options.kind) return false;
      if (options.sourceSheet && part.sourceSheet !== options.sourceSheet) return false;
      return true;
    });
    const suggestions = sortSearchMatches(filtered, options.query, partSearchText, options.limit).map(snapshotSuggestion);
    return {
      source: "snapshot" as const,
      suggestions
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

export async function searchCatalog(event: unknown, rawOptions: Partial<CatalogSearchOptions>) {
  return searchCatalogRows(event, rawOptions);
}

export async function loadCatalog(event: unknown, rawOptions: Partial<CatalogQueryOptions> = {}): Promise<{
  parts: GenericPart[];
  source: "d1" | "snapshot";
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
  const db = getDb(event);

  if (!db) {
    const snapshot = await readSnapshot();
    const searched = options.search
      ? sortSearchMatches(
          snapshot.parts.filter((part) => {
            if (options.kind && part.kind !== options.kind) return false;
            if (options.sourceSheet && part.sourceSheet !== options.sourceSheet) return false;
            return true;
          }),
          options.search,
          partSearchText
        )
      : undefined;
    const filtered = searched ?? filterSnapshotParts(snapshot.parts, options);
    const offset = (options.page - 1) * options.pageSize;

    return {
      parts: filtered.slice(offset, offset + options.pageSize),
      source: "snapshot",
      summary: {
        ...summarizeParts(snapshot.parts),
        filteredTotal: filtered.length
      },
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        pageCount: Math.max(1, Math.ceil(filtered.length / options.pageSize))
      }
    };
  }

  const offset = (options.page - 1) * options.pageSize;
  let parts: GenericPart[] = [];
  let filteredTotal = 0;

  if (options.search) {
    const searchIds = (await searchCatalogRows(event, { query: options.search, kind: options.kind, sourceSheet: options.sourceSheet, limit: 1000 }))
      .suggestions.map((suggestion) => suggestion.id);
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
    const rows = await db
      .prepare(`select * from sff_parts ${where} order by kind, display_name limit ? offset ?`)
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
