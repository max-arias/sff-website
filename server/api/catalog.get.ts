import { loadCatalog } from "../utils/d1";

export default defineEventHandler(async (event) => {
  const catalog = await loadCatalog(event);

  return {
    source: catalog.source,
    summary: catalog.summary,
    parts: catalog.parts
  };
});
