import { checkCaseGpuCompatibility } from "../../app/lib/compatibility";
import { findCaseAndGpu } from "../utils/d1";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ caseId?: string; gpuId?: string }>(event);

  if (!body.caseId || !body.gpuId) {
    throw createError({ statusCode: 400, statusMessage: "caseId and gpuId are required" });
  }

  const { casePart, gpuPart, source } = await findCaseAndGpu(event, body.caseId, body.gpuId);

  if (!casePart || !gpuPart) {
    throw createError({ statusCode: 404, statusMessage: "Selected case or GPU was not found" });
  }

  return {
    source,
    case: casePart,
    gpu: gpuPart,
    result: checkCaseGpuCompatibility(casePart, gpuPart)
  };
});
