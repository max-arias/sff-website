import type { APIRoute } from "astro";
import { checkCaseGpuCompatibility } from "../../lib/compatibility";
import { findCaseAndGpu } from "../../server/d1";

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => ({})) as { caseId?: string; gpuId?: string };

  if (!body.caseId || !body.gpuId) {
    return Response.json({ error: "caseId and gpuId are required" }, { status: 400 });
  }

  const { casePart, gpuPart, source } = await findCaseAndGpu(context, body.caseId, body.gpuId);

  if (!casePart || !gpuPart) {
    return Response.json({ error: "Selected case or GPU was not found" }, { status: 404 });
  }

  return Response.json({
    source,
    case: casePart,
    gpu: gpuPart,
    result: checkCaseGpuCompatibility(casePart, gpuPart)
  });
};
