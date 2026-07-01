import { loadCatalog } from "../utils/d1";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const catalog = await loadCatalog(event, {
    page: Number(query.page ?? 1),
    pageSize: Number(query.pageSize ?? 50),
    kind: typeof query.kind === "string" ? query.kind : undefined,
    sourceSheet: typeof query.sourceSheet === "string" ? query.sourceSheet : undefined,
    search: typeof query.search === "string" ? query.search : undefined
  });

  return {
    source: catalog.source,
    summary: catalog.summary,
    pagination: catalog.pagination,
    parts: catalog.parts
  };
});
