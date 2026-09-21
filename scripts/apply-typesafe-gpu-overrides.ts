import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportPath = resolve(".data/typesafe-gpu-normalization-probe.json");
const sqlPath = resolve(".data/typesafe-gpu-dimension-overrides.sql");
const jsonPath = resolve(".data/typesafe-gpu-dimension-overrides.json");
const thresholdArg = process.argv.find((arg) => arg.startsWith("--min-confidence="));
const minConfidence = Number(thresholdArg?.slice("--min-confidence=".length) ?? 0.9);

const report = JSON.parse(await readFile(reportPath, "utf8")) as {
  matches: Array<{
    source: { id: string; length_mm: number | null };
    candidates: Array<{ id: string; length_mm: number | null; width_mm: number | null; thickness_mm: number | null }>;
    answer: { choice: string; confidence: number };
  }>;
};

const overrides = report.matches.flatMap((match) => {
  if (!match.answer.choice.startsWith("candidate_")) return [];
  if (match.answer.confidence < minConfidence) return [];
  const candidateIndex = Number(match.answer.choice.slice("candidate_".length));
  const candidate = match.candidates[candidateIndex];
  if (!candidate) return [];
  if (candidate.length_mm === null || candidate.width_mm === null || candidate.thickness_mm === null) return [];
  if (match.source.length_mm !== candidate.length_mm) return [];
  return [{
    sourceId: match.source.id,
    candidateId: candidate.id,
    confidence: match.answer.confidence,
    lengthMm: candidate.length_mm,
    widthMm: candidate.width_mm,
    thicknessMm: candidate.thickness_mm,
  }];
});

const sql = [
  "-- Generated from .data/typesafe-gpu-normalization-probe.json.",
  `-- Jev threshold: confidence >= ${minConfidence}; source and candidate lengths must match.`,
  ...overrides.map((override) =>
    `update gpus set width_mm = ${override.widthMm}, thickness_mm = ${override.thicknessMm} where id = '${override.sourceId.replaceAll("'", "''")}' and length_mm = ${override.lengthMm} and width_mm is null and thickness_mm is null;`,
  ),
  "",
].join("\n");

await writeFile(sqlPath, sql);
await writeFile(jsonPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  minConfidence,
  count: overrides.length,
  overrides,
}, null, 2));
console.log(`Prepared ${overrides.length} exact-length GPU dimension overrides.`);
console.log(`Wrote ${sqlPath}`);
console.log(`Wrote ${jsonPath}`);
