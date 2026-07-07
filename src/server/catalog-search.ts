import Fuse from "fuse.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalogSearchRow {
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

interface SearchDoc extends CatalogSearchRow {
  /** All searchable text, lower-cased and stripped to alphanumeric,
   *  so compact/no-space queries like "thorzone" match "Thor Zone". */
  compact: string;
}

interface FuseSearchResult {
  item: SearchDoc;
  score?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function rowSearchText(row: CatalogSearchRow): string {
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

function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// ---------------------------------------------------------------------------
// Public search function
// ---------------------------------------------------------------------------

export function fuseSearchRows(
  rows: CatalogSearchRow[],
  query: string,
  limit: number
): (CatalogSearchRow & { score: number })[] {
  if (!rows.length) return [];

  const compactQuery = normalizeSearchText(query);
  if (!compactQuery) return [];

  const compactTerms = query.split(/\s+/).map(normalizeSearchText).filter(Boolean);

  const docs: SearchDoc[] = rows.map((row) => ({
    ...row,
    compact: normalizeSearchText(rowSearchText(row))
  }));

  const fuse = new Fuse(docs, {
    keys: [
      { name: "display_name", weight: 2 },
      { name: "brand", weight: 1.5 },
      { name: "name", weight: 1.5 },
      { name: "compact", weight: 1.8 },
      { name: "kind", weight: 1 },
      { name: "source_sheet", weight: 0.5 },
      { name: "status", weight: 0.5 },
      { name: "gpu_chipset", weight: 1 },
      { name: "gpu_model", weight: 1 },
      { name: "case_seller", weight: 1 },
      { name: "case_style", weight: 1 }
    ],
    threshold: 0.4,
    distance: 100,
    includeScore: true
  });

  return fuse
    .search(query)
    .map((result: FuseSearchResult) => {
      const exactCompactBoost =
        result.item.compact.indexOf(compactQuery) === -1
          ? 0
          : 2 - Math.min(result.item.compact.indexOf(compactQuery), 100) / 1000;
      const matchesAllTerms = compactTerms.every((term) =>
        result.item.compact.includes(term)
      );
      return {
        ...result.item,
        score: exactCompactBoost + (1 - (result.score ?? 1)),
        matchesAllTerms
      };
    })
    .filter(
      (result) =>
        result.score >= 0.6 &&
        (compactTerms.length < 2 || result.matchesAllTerms) &&
        // For single-term (no-space) queries, require an exact compact substring
        // match so "thorzone" does not false-match "Shark Zone" (compact: "sharkzone").
        (compactTerms.length !== 1 ||
          result.compact.indexOf(compactQuery) !== -1)
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
