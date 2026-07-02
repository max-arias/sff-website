globalThis.process ??= {};
globalThis.process.env ??= {};
import { r as __exportAll } from "./rolldown-runtime_CTVlGNzl.mjs";
import { a as searchCatalog } from "./d1_BFQLMHTc.mjs";
//#region src/pages/api/catalog/search.ts
var search_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (context) => {
	const query = context.url.searchParams;
	const result = await searchCatalog(context, {
		query: query.get("q") ?? "",
		limit: Number(query.get("limit") ?? 8),
		kind: query.get("kind") ?? void 0,
		sourceSheet: query.get("sourceSheet") ?? void 0
	});
	return Response.json(result);
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/catalog/search@_@ts
var page = () => search_exports;
//#endregion
export { page };
