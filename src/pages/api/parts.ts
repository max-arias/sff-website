import type { APIRoute } from "astro";
import { loadParts } from "../../server/d1";

export const GET: APIRoute = async (context) => {
  const parts = await loadParts(context);

  return Response.json({
    source: parts.source,
    cases: parts.cases,
    gpus: parts.gpus
  });
};
