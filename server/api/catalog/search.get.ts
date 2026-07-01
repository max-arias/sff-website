import { searchCatalog } from "../../utils/d1";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const result = await searchCatalog(event, {
    query: typeof query.q === "string" ? query.q : "",
    limit: Number(query.limit ?? 8),
    kind: typeof query.kind === "string" ? query.kind : undefined,
    sourceSheet: typeof query.sourceSheet === "string" ? query.sourceSheet : undefined
  });

  return result;
});
