import type { APIRoute } from "astro";
import { searchCatalog } from "../../../server/d1";

export const GET: APIRoute = async (context) => {
  const query = context.url.searchParams;
  const result = await searchCatalog(context, {
    query: query.get("q") ?? "",
    limit: Number(query.get("limit") ?? 8),
    kind: query.get("kind") ?? undefined,
    sourceSheet: query.get("sourceSheet") ?? undefined
  });

  return Response.json(result);
};
