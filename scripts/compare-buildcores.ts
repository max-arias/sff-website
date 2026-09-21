import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type CatalogPart = { kind: string; brand: string; name: string; displayName: string };
type AcceptedRecord = { id: string; name: string; manufacturer: string; fields: string[]; dimensions: Record<string, number | string> };
type AuditCategory = { category: string; acceptedRecords: AcceptedRecord[] };

const auditPath = resolve(".data/buildcores-dimensional-audit.json");
const catalogPath = resolve(".data/intake-snapshot.json");
const outputPath = resolve(".data/buildcores-catalog-comparison.json");

const kindMap: Record<string, string> = {
  PCCase: "case",
  GPU: "gpu",
  CPUCooler: "cpu-cooler",
  PSU: "psu",
  Motherboard: "motherboard",
  RAM: "ram",
  CaseFan: "fan",
};

function identity(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return [...new Set(identity(value).split(" ").filter((token) => token.length > 1))];
}

function deterministicNameMatch(record: AcceptedRecord, part: CatalogPart): boolean {
  const manufacturer = identity(record.manufacturer);
  const brand = identity(part.brand);
  if (!manufacturer || !brand || manufacturer !== brand) return false;
  const sourceTokens = tokens(record.name);
  const catalogTokens = tokens(part.name);
  if (sourceTokens.length < 2 || catalogTokens.length < 2) return false;
  const overlap = sourceTokens.filter((token) => catalogTokens.includes(token)).length;
  return overlap >= 2 && overlap / Math.min(sourceTokens.length, catalogTokens.length) >= 0.8;
}

function partKeys(part: CatalogPart): Set<string> {
  return new Set([identity(`${part.brand} ${part.name}`), identity(part.displayName), identity(part.name)]);
}

function recordKeys(record: AcceptedRecord): Set<string> {
  return new Set([identity(`${record.manufacturer} ${record.name}`), identity(record.name)]);
}

const audit = JSON.parse(await readFile(auditPath, "utf8")) as { generatedAt: string; categories: AuditCategory[] };
const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as { generatedAt: string; parts: CatalogPart[] };
const catalogByKind = new Map<string, Array<{ part: CatalogPart; keys: Set<string> }>>();
for (const part of catalog.parts) {
  const entries = catalogByKind.get(part.kind) ?? [];
  entries.push({ part, keys: partKeys(part) });
  catalogByKind.set(part.kind, entries);
}
const categories = audit.categories.map((category) => {
  const kind = kindMap[category.category];
  const candidates = catalogByKind.get(kind) ?? [];
  let exactMatches = 0;
  let deterministicMatches = 0;
  let ambiguousMatches = 0;
  const unmatchedExamples: Array<{ id: string; name: string; manufacturer: string }> = [];

  for (const record of category.acceptedRecords) {
    const keys = recordKeys(record);
    const exact = candidates.filter(({ keys: candidateKeys }) =>
      [...keys].some((key) => key !== "" && candidateKeys.has(key)),
    );
    if (exact.length > 0) {
      exactMatches += 1;
      continue;
    }
    const deterministic = candidates.filter(({ part }) => deterministicNameMatch(record, part));
    if (deterministic.length === 1) deterministicMatches += 1;
    else if (deterministic.length > 1) ambiguousMatches += 1;
    else if (unmatchedExamples.length < 20) unmatchedExamples.push(record);
  }

  return {
    sourceCategory: category.category,
    catalogKind: kind,
    sourceAccepted: category.acceptedRecords.length,
    currentCatalog: candidates.length,
    exactNameMatches: exactMatches,
    deterministicNameMatches: deterministicMatches,
    ambiguousNameMatches: ambiguousMatches,
    unmatchedByName: category.acceptedRecords.length - exactMatches - deterministicMatches - ambiguousMatches,
    unmatchedExamples,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  sourceAuditGeneratedAt: audit.generatedAt,
  catalogGeneratedAt: catalog.generatedAt,
  matching: "Exact normalized keys, then unique same-manufacturer token overlap; no records were merged.",
  categories,
};
await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
console.table(categories);
console.log(`Wrote ${outputPath}`);
