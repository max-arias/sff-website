import { fetchAndNormalizeAll } from "../../../app/lib/sheets";
import { buildSeedSql } from "../../../app/lib/sql";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const token = getHeader(event, "x-intake-token");

  if (config.intakeToken && token !== config.intakeToken) {
    throw createError({ statusCode: 401, statusMessage: "Invalid intake token" });
  }

  const result = await fetchAndNormalizeAll();

  return {
    generatedAt: result.generatedAt,
    partCount: result.parts.length,
    caseCount: result.cases.length,
    gpuCount: result.gpus.length,
    warningCount: result.warnings.length,
    warnings: result.warnings,
    seedSql: buildSeedSql(result)
  };
});
