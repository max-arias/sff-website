globalThis.process ??= {};
globalThis.process.env ??= {};
import { r as __exportAll } from "./rolldown-runtime_CTVlGNzl.mjs";
import { t as findCaseAndGpu } from "./d1_BFQLMHTc.mjs";
import { t as checkCaseGpuCompatibility } from "./compatibility_D89vkBH-.mjs";
//#region src/pages/api/compatibility.ts
var compatibility_exports = /* @__PURE__ */ __exportAll({ POST: () => POST });
var POST = async (context) => {
	const body = await context.request.json().catch(() => ({}));
	if (!body.caseId || !body.gpuId) return Response.json({ error: "caseId and gpuId are required" }, { status: 400 });
	const { casePart, gpuPart, source } = await findCaseAndGpu(context, body.caseId, body.gpuId);
	if (!casePart || !gpuPart) return Response.json({ error: "Selected case or GPU was not found" }, { status: 404 });
	return Response.json({
		source,
		case: casePart,
		gpu: gpuPart,
		result: checkCaseGpuCompatibility(casePart, gpuPart)
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/compatibility@_@ts
var page = () => compatibility_exports;
//#endregion
export { page };
