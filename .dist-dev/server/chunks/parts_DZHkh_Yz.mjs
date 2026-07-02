globalThis.process ??= {};
globalThis.process.env ??= {};
import { r as __exportAll } from "./rolldown-runtime_CTVlGNzl.mjs";
import { i as loadParts } from "./d1_BFQLMHTc.mjs";
//#region src/pages/api/parts.ts
var parts_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (context) => {
	const parts = await loadParts(context);
	return Response.json({
		source: parts.source,
		cases: parts.cases,
		gpus: parts.gpus
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/parts@_@ts
var page = () => parts_exports;
//#endregion
export { page };
