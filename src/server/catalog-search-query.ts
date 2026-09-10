export const CATALOG_SEARCH_READ_BUDGET = 100;

export type CatalogSearchStatement = {
  sql: string;
  values: Array<string | number>;
};

/**
 * Builds the bounded FTS5 statement used for every catalog search.
 * `limit` is both the response cap and the maximum allowed D1 rows read.
 */
export function buildCatalogSearchStatement(
  query: string,
  kind: string | undefined,
  limit: number,
): CatalogSearchStatement {
  const values: Array<string | number> = [query];
  const kindClause = kind ? "and kind = ?" : "";
  if (kind) values.push(kind);
  values.push(limit);

  return {
    sql: `select id, kind, display_name, normalized_search_text
      from catalog_search
      where catalog_search match ? ${kindClause}
      order by rank
      limit ?`,
    values,
  };
}
