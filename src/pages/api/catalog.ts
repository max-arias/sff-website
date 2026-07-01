import type { APIRoute } from "astro";
import { loadCatalog } from "../../server/d1";

export const GET: APIRoute = async (context) => {
  const query = context.url.searchParams;
  const catalog = await loadCatalog(context, {
    page: Number(query.get("page") ?? 1),
    pageSize: Number(query.get("pageSize") ?? 50),
    kind: query.get("kind") ?? undefined,
    sourceSheet: query.get("sourceSheet") ?? undefined,
    search: query.get("search") ?? undefined
  });

  return Response.json({
    source: catalog.source,
    summary: catalog.summary,
    pagination: catalog.pagination,
    parts: catalog.parts
  });
};
