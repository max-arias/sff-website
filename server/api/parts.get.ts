import { loadParts } from "../utils/d1";

export default defineEventHandler(async (event) => {
  const parts = await loadParts(event);

  return {
    source: parts.source,
    cases: parts.cases,
    gpus: parts.gpus
  };
});
