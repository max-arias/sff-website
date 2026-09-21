import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

const execFileAsync = promisify(execFile);
const outputPath = resolve(".data/typesafe-gpu-normalization-probe.json");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Number(limitArg?.slice("--limit=".length) ?? 20));

if (!process.env.TYPESAFE_API_KEY) {
  throw new Error("TYPESAFE_API_KEY is required");
}

type GpuRow = {
  id: string;
  brand: string;
  name: string;
  model: string;
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  pcie_bracket: string;
};

type D1Result = { results: GpuRow[] };

type Match = {
  source: GpuRow;
  candidates: GpuRow[];
  answer: unknown;
};

const query = `select id, brand, name, model, length_mm, width_mm, thickness_mm, pcie_bracket
from gpus
where length_mm is not null and width_mm is null and thickness_mm is null
order by length(name) desc, name
limit ${limit}`;
const { stdout } = await execFileAsync("npx", [
  "wrangler",
  "d1",
  "execute",
  "sff-builder",
  "--local",
  "--json",
  "--command",
  query,
], { maxBuffer: 20 * 1024 * 1024 });
const queryResult = JSON.parse(stdout) as D1Result[];
const sourceRows = queryResult[0]?.results ?? [];

const allQuery = `select id, brand, name, model, length_mm, width_mm, thickness_mm, pcie_bracket
from gpus
order by name`;
const allOutput = await execFileAsync("npx", [
  "wrangler",
  "d1",
  "execute",
  "sff-builder",
  "--local",
  "--json",
  "--command",
  allQuery,
], { maxBuffer: 20 * 1024 * 1024 });
const allResult = JSON.parse(allOutput.stdout) as D1Result[];
const allRows = allResult[0]?.results ?? [];

const stopWords = new Set([
  "amd", "nvidia", "intel", "graphics", "card", "video", "gddr", "ddr", "oc",
  "edition", "black", "white", "silver", "red", "blue", "gb", "mb", "the",
]);

function tokens(value: string) {
  return new Set(
    value.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !stopWords.has(token)),
  );
}

function overlap(a: GpuRow, b: GpuRow) {
  const left = tokens(`${a.brand} ${a.model} ${a.name}`);
  const right = tokens(`${b.brand} ${b.model} ${b.name}`);
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  const union = new Set([...left, ...right]).size;
  const manufacturer = a.brand && b.brand && a.brand.toLowerCase() === b.brand.toLowerCase() ? 0.2 : 0;
  return shared / Math.max(1, union) + manufacturer;
}

function shortlist(source: GpuRow) {
  return allRows
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => ({ candidate, score: overlap(source, candidate) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ candidate }) => candidate);
}

const client = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY });
const matches: Match[] = [];

for (const source of sourceRows) {
  const candidates = shortlist(source);
  const criteria: Record<string, string> = {
    no_match: "No candidate is the same physical board variant. Do not match a reference or family record to a partner-board variant.",
    review: "The source and candidates may refer to the same product family, but the evidence is insufficient to identify the exact board variant.",
  };
  candidates.forEach((candidate, index) => {
    criteria[`candidate_${index}`] = `Exact same physical board variant as source. Candidate: ${candidate.brand} ${candidate.name}; dimensions: length ${candidate.length_mm ?? "unknown"} mm, width ${candidate.width_mm ?? "unknown"} mm, thickness ${candidate.thickness_mm ?? "unknown"} mm, slots ${candidate.pcie_bracket || "unknown"}.`;
  });

  const response = await client.systemOne({
    model: "jev-latest",
    state: {
      source: {
        id: source.id,
        brand: source.brand,
        model: source.model,
        name: source.name,
        dimensions: {
          lengthMm: source.length_mm,
          widthMm: source.width_mm,
          thicknessMm: source.thickness_mm,
          slotWidth: source.pcie_bracket,
        },
      },
      candidates: candidates.map((candidate, index) => ({
        option: `candidate_${index}`,
        id: candidate.id,
        brand: candidate.brand,
        model: candidate.model,
        name: candidate.name,
        dimensions: {
          lengthMm: candidate.length_mm,
          widthMm: candidate.width_mm,
          thicknessMm: candidate.thickness_mm,
          slotWidth: candidate.pcie_bracket,
        },
      })),
    },
    questions: {
      match: choice(
        "Which candidate, if any, is the exact same physical GPU board variant as the source? Treat family/chipset similarity as insufficient. Preserve distinct brands, coolers, editions, and board variants as different products.",
        criteria,
      ),
    },
  });

  matches.push({ source, candidates, answer: response.answers.match });
  console.log(`${source.brand} ${source.name}: ${JSON.stringify(response.answers.match)}`);
}

await writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), limit, matches }, null, 2));
console.log(`Wrote ${outputPath}`);
