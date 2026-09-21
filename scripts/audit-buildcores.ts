import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join, resolve } from "node:path";

const execFileAsync = promisify(execFile);
const repository = "buildcores/buildcores-open-db";
const ref = process.env.BUILDCORES_REF ?? "main";
const archiveUrl = `https://codeload.github.com/${repository}/tar.gz/refs/heads/${ref}`;
const outputPath = resolve(".data/buildcores-dimensional-audit.json");
const workPath = resolve(".data/buildcores-audit-source");

const categories = [
  "PCCase",
  "GPU",
  "CPUCooler",
  "PSU",
  "Motherboard",
  "RAM",
  "CaseFan",
] as const;

type Category = (typeof categories)[number];
type JsonRecord = Record<string, unknown>;
type Eligibility = { accepted: boolean; fields: string[] };
type AcceptedRecord = {
  id: string;
  name: string;
  manufacturer: string;
  fields: string[];
  dimensions: Record<string, number | string>;
};

type CategorySummary = {
  category: Category;
  scanned: number;
  accepted: number;
  rejected: number;
  fieldCoverage: Record<string, number>;
  acceptedRecords: AcceptedRecord[];
  rejectedExamples: Array<{ id: string; name: string }>;
};
 
function valueAt(record: JsonRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as JsonRecord)[key];
  }, record);
}

function projectDimensions(category: Category, record: JsonRecord): Record<string, number | string> {
  const pathsByCategory: Record<Category, Record<string, string>> = {
    PCCase: {
      lengthMm: "dimensions_mm.depth",
      widthMm: "dimensions_mm.width",
      heightMm: "dimensions_mm.height",
      volumeL: "volume",
      gpuLengthMm: "max_video_card_length",
      cpuCoolerHeightMm: "max_cpu_cooler_height",
      pcieSlots: "expansion_slots",
    },
    GPU: { lengthMm: "length", thicknessSlots: "total_slot_width" },
    CPUCooler: { heightMm: "height" },
    PSU: { lengthMm: "length", formFactor: "form_factor" },
    Motherboard: { formFactor: "form_factor" },
    RAM: { heightMm: "height" },
    CaseFan: { sizeMm: "size" },
  };
  return Object.fromEntries(
    Object.entries(pathsByCategory[category])
      .map(([name, path]) => [name, valueAt(record, path)] as const)
      .filter((entry): entry is [string, number | string] => typeof entry[1] === "number" || typeof entry[1] === "string"),
  );
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasAny(record: JsonRecord, paths: string[]): string[] {
  return paths.filter((path) => {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as JsonRecord)[key];
    }, record);
    return isFinitePositive(value) || (typeof value === "string" && value.trim() !== "");
  });
}

function eligibility(category: Category, record: JsonRecord): Eligibility {
  if (category === "PCCase") return caseEligibility(record);
  const fieldSets: Record<Category, string[]> = {
    PCCase: [],
    GPU: ["length", "width", "height", "total_slot_width"],
    CPUCooler: ["dimensions_mm.depth", "dimensions_mm.width", "dimensions_mm.height", "height", "width", "length"],
    PSU: ["dimensions_mm.depth", "dimensions_mm.width", "dimensions_mm.height", "depth", "width", "height", "length", "form_factor"],
    Motherboard: ["dimensions_mm.depth", "dimensions_mm.width", "dimensions_mm.height", "form_factor"],
    RAM: ["height", "height_mm", "dimensions_mm.height", "module_height"],
    CaseFan: ["size", "diameter", "diameter_mm", "thickness", "thickness_mm", "dimensions_mm.height"],
  };
  const fields = hasAny(record, fieldSets[category]);
  return { accepted: fields.length > 0, fields };
}

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(path, entry.name);
      return entry.isDirectory() ? filesUnder(entryPath) : [entryPath];
    }),
  );
  return nested.flat().filter((entryPath) => entryPath.endsWith(".json"));
}

function caseEligibility(record: JsonRecord): Eligibility {
  const fields = hasAny(record, [
    "dimensions_mm.depth",
    "dimensions_mm.width",
    "dimensions_mm.height",
  ]);
  return { accepted: fields.length > 0, fields };
}
async function downloadAndExtract() {
  await rm(workPath, { recursive: true, force: true });
  await mkdir(workPath, { recursive: true });
  const archivePath = join(workPath, "source.tar.gz");
  const response = await fetch(archiveUrl);
  if (!response.ok || !response.body) throw new Error(`BuildCores download failed: ${response.status} ${response.statusText}`);
  await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
  const wildcards = categories.map((category) => `*/open-db/${category}/*.json`);
  await execFileAsync("tar", ["-xzf", archivePath, "-C", workPath, "--wildcards", ...wildcards]);
  await rm(archivePath, { force: true });
}

async function main() {
  await downloadAndExtract();
  const root = join(workPath, `buildcores-open-db-${ref}`);
  const summaries: CategorySummary[] = [];

  for (const category of categories) {
    const categoryPath = join(root, "open-db", category);
    const categoryFiles = await filesUnder(categoryPath);
    const fieldCoverage: Record<string, number> = {};
    const acceptedRecords: CategorySummary["acceptedRecords"] = [];
    const rejectedExamples: CategorySummary["rejectedExamples"] = [];
    let accepted = 0;

    for (const filePath of categoryFiles) {
      const record = JSON.parse(await readFile(filePath, "utf8")) as JsonRecord;
      const result = eligibility(category, record);
      const metadata = (record.metadata ?? {}) as JsonRecord;
      const id = String(record.opendb_id ?? "");
      const name = String(metadata.name ?? record.name ?? "");
      const manufacturer = String(metadata.manufacturer ?? "");

      if (result.accepted) {
        accepted += 1;
        acceptedRecords.push({
          id,
          name,
          manufacturer,
          fields: result.fields,
          dimensions: projectDimensions(category, record),
        });
      } else if (rejectedExamples.length < 20) {
        rejectedExamples.push({ id, name });
      }
      for (const field of result.fields) fieldCoverage[field] = (fieldCoverage[field] ?? 0) + 1;
    }

    summaries.push({
      category,
      scanned: categoryFiles.length,
      accepted,
      rejected: categoryFiles.length - accepted,
      fieldCoverage,
      acceptedRecords,
      rejectedExamples,
    });
  }

  const idCategories = new Map<string, string[]>();
  for (const summary of summaries) {
    for (const record of summary.acceptedRecords) {
      const categoriesForId = idCategories.get(record.id) ?? [];
      categoriesForId.push(summary.category);
      idCategories.set(record.id, categoriesForId);
    }
  }
  const duplicateIds = [...idCategories.entries()]
    .filter(([, idCategoriesForRecord]) => idCategoriesForRecord.length > 1)
    .map(([id, idCategoriesForRecord]) => ({ id, categories: idCategoriesForRecord }));

  const report = {
    generatedAt: new Date().toISOString(),
    source: `https://github.com/${repository}/tree/${ref}`,
    ref,
    eligibility: "At least one mapped physical or fitment-relevant field is present.",
    duplicateIds,
    categories: summaries,
  };
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.table(summaries.map(({ category, scanned, accepted, rejected }) => ({ category, scanned, accepted, rejected })));
  console.log(`Wrote ${outputPath}`);
  await rm(workPath, { recursive: true, force: true });
}

await main();
