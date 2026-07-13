import type { APIRoute } from "astro";
import { evaluateGpuAgainstCase } from "../../fitment/engine";
import { D1CatalogStore } from "../../server/d1-catalog-store";

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => ({})) as { caseId?: string; gpuId?: string };

  if (!body.caseId || !body.gpuId) {
    return Response.json({ error: "caseId and gpuId are required" }, { status: 400 });
  }

  const store = new D1CatalogStore(context);
  const { casePart, gpuPart } = await store.findCaseAndGpu(body.caseId, body.gpuId);

  if (!casePart || !gpuPart) {
    return Response.json({ error: "Selected case or GPU was not found" }, { status: 404 });
  }

  const evidence = evaluateGpuAgainstCase(gpuPart, casePart);
  const hasError = evidence.some((e) => e.verdict === "fail");
  const hasWarning = evidence.some((e) => e.verdict === "conditional");
  const verdict = hasError ? "fail" : hasWarning ? "conditional" : "pass";

  /**
   * Convert engine evidence back to the legacy CompatibilityResult shape.
   * This preserves backward compatibility for any API consumers.
   */
  const issues = evidence
    .filter((e) => e.verdict !== "pass")
    .map((e) => ({
      code: e.code,
      severity: e.verdict === "fail" ? ("error" as const) : ("warning" as const),
      message: e.message,
    }));
  const clearances: Record<string, number | null> = {};
  if (casePart.dimensions.gpuLengthMm !== null && gpuPart.dimensions.lengthMm !== null)
    clearances.gpuLengthMm = casePart.dimensions.gpuLengthMm - gpuPart.dimensions.lengthMm;
  if (casePart.dimensions.gpuWidthMm !== null && gpuPart.dimensions.widthMm !== null)
    clearances.gpuWidthMm = casePart.dimensions.gpuWidthMm - gpuPart.dimensions.widthMm;
  if (casePart.dimensions.gpuThicknessMm !== null && gpuPart.dimensions.thicknessMm !== null)
    clearances.gpuThicknessMm = casePart.dimensions.gpuThicknessMm - gpuPart.dimensions.thicknessMm;
  if (casePart.dimensions.pcieSlots !== null && gpuPart.dimensions.pcieSlots !== null)
    clearances.pcieSlots = casePart.dimensions.pcieSlots - gpuPart.dimensions.pcieSlots;

  return Response.json({
    source: "d1",
    case: casePart,
    gpu: gpuPart,
    result: { verdict, issues, clearances }
  });
};
