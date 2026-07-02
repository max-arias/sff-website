globalThis.process ??= {};
globalThis.process.env ??= {};
import { r as __exportAll } from "./rolldown-runtime_CTVlGNzl.mjs";
import { n as loadCatalog } from "./d1_BFQLMHTc.mjs";
//#region src/pages/api/catalog.ts
var catalog_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (context) => {
	const query = context.url.searchParams;
	const catalog = await loadCatalog(context, {
		page: Number(query.get("page") ?? 1),
		pageSize: Number(query.get("pageSize") ?? 50),
		kind: query.get("kind") ?? void 0,
		sourceSheet: query.get("sourceSheet") ?? void 0,
		search: query.get("search") ?? void 0
	});
	return Response.json({
		source: catalog.source,
		summary: catalog.summary,
		pagination: catalog.pagination,
		parts: catalog.parts
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/catalog@_@ts
var page = () => catalog_exports;
//#endregion
export { page };
