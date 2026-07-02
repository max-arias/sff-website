import type { APIRoute } from "astro";
import { loadCatalogPartsByIds } from "../../../server/d1";

export const GET: APIRoute = async (context) => {
  const ids = (context.url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const result = await loadCatalogPartsByIds(context, ids);

  return Response.json(result);
};
