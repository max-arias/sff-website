globalThis.process ??= {};
globalThis.process.env ??= {};
import { r as __exportAll } from "./rolldown-runtime_CTVlGNzl.mjs";
import { r as loadCatalogPartsByIds } from "./d1_BFQLMHTc.mjs";
//#region src/pages/api/catalog/lookup.ts
var lookup_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (context) => {
	const result = await loadCatalogPartsByIds(context, (context.url.searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean));
	return Response.json(result);
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/catalog/lookup@_@ts
var page = () => lookup_exports;
//#endregion
export { page };
