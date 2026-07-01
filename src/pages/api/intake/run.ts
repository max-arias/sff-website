import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { fetchAndNormalizeAll } from "../../../lib/sheets";
import { buildSeedSql } from "../../../lib/sql";

export const POST: APIRoute = async (context) => {
  const intakeToken = env.INTAKE_TOKEN ?? import.meta.env.INTAKE_TOKEN ?? "";
  const token = context.request.headers.get("x-intake-token");

  if (intakeToken && token !== intakeToken) {
    return Response.json({ error: "Invalid intake token" }, { status: 401 });
  }

  const result = await fetchAndNormalizeAll();

  return Response.json({
    generatedAt: result.generatedAt,
    partCount: result.parts.length,
    caseCount: result.cases.length,
    gpuCount: result.gpus.length,
    warningCount: result.warnings.length,
    warnings: result.warnings,
    seedSql: buildSeedSql(result)
  });
};
