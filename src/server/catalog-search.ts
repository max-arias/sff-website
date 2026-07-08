import Fuse from "fuse.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalogSearchRow {
  id: string;
  [key: string]: unknown;
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
  return Object.values(row)
    .filter(v => typeof v === "string" || typeof v === "number")
    .map(String)
    .join(" ");
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

  // Use all available keys from the first row (minus id and compact)
  const searchKeys = docs.length > 0
    ? Object.keys(docs[0]).filter(k => k !== "id" && k !== "compact")
    : [];

  const fuse = new Fuse(docs, {
    keys: searchKeys,
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
