import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildSeedSql } from "../src/lib/sql";
import type { GenericPart, IntakeResult, PartKind } from "../src/types";

type AcceptedRecord = {
  id: string;
  name: string;
  manufacturer: string;
  fields: string[];
  dimensions: Record<string, number | string>;
};
type AuditCategory = { category: string; acceptedRecords: AcceptedRecord[] };

const snapshotPath = resolve(".data/intake-snapshot.json");
const auditPath = resolve(".data/buildcores-dimensional-audit.json");
const outputPath = resolve(".data/intake-seed-buildcores.sql");
const jevOverridesPath = resolve(".data/typesafe-gpu-dimension-overrides.sql");

const kindMap: Record<string, PartKind> = {
  PCCase: "case",
  GPU: "gpu",
  CPUCooler: "cpu-cooler",
  PSU: "psu",
  Motherboard: "motherboard",
  RAM: "ram",
  CaseFan: "fan",
};

function sourceDimensions(category: string, record: AcceptedRecord): Record<string, number> {
  const fieldMap: Record<string, Record<string, string>> = {
    PCCase: {
      lengthMm: "case_length",
      widthMm: "case_width",
      heightMm: "case_height",
      volumeL: "volume",
      gpuLengthMm: "gpu_length",
      cpuCoolerHeightMm: "cpu_cooler_height",
      pcieSlots: "pcie_slots",
    },
    GPU: { lengthMm: "length" },
    CPUCooler: { heightMm: "height" },
    PSU: { lengthMm: "length" },
    Motherboard: {},
    RAM: { heightMm: "height" },
    CaseFan: { sizeMm: "size" },
  };
  return Object.fromEntries(
    Object.entries(record.dimensions)
      .filter(([, value]) => typeof value === "number")
      .map(([key, value]) => [fieldMap[category]?.[key] ?? key, value as number] as const),
  ) as Record<string, number>;
}

function sourceSpec(category: string, record: AcceptedRecord): Record<string, string> {
  const specs = Object.fromEntries(
    Object.entries(record.dimensions)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, String(value)]),
  );
  if (category === "GPU" && typeof record.dimensions.thicknessSlots === "number") {
    specs.pcie_bracket = `${record.dimensions.thicknessSlots} slots`;
  }
  if (category === "PCCase" || category === "PSU" || category === "Motherboard") {
    specs.form_factor = specs.formFactor ?? "";
  }
  return specs;
}

function toGenericPart(category: string, record: AcceptedRecord, index: number): GenericPart {
  const kind = kindMap[category];
  if (!kind) throw new Error(`Unsupported BuildCores category: ${category}`);
  const sourceSheet = `BuildCores/${category}`;
  return {
    id: `buildcores-${category.toLowerCase()}-${record.id}`,
    kind,
    sourceSheet,
    rowNumber: index + 1,
    brand: record.manufacturer,
    name: record.name,
    displayName: `${record.manufacturer} ${record.name}`.trim(),
    status: "",
    availabilityStatus: "available",
    sellerUrl: "",
    productUrl: "",
    specs: sourceSpec(category, record),
    dimensions: sourceDimensions(category, record),
    releaseYear: null,
    flags: ["source:buildcores", ...record.fields.map((field) => `source-field:${field}`)],
    raw: {
      source: "BuildCores OpenDB",
      source_record_id: record.id,
      source_category: category,
      source_name: record.name,
      source_manufacturer: record.manufacturer,
      ...record.dimensions,
    },
    links: {},
  };
}

const current = JSON.parse(await readFile(snapshotPath, "utf8")) as IntakeResult;
const audit = JSON.parse(await readFile(auditPath, "utf8")) as { categories: AuditCategory[] };
const buildcoresParts = audit.categories.flatMap((category) =>
  category.acceptedRecords.map((record, index) => toGenericPart(category.category, record, index)),
);
const merged: IntakeResult = {
  ...current,
  generatedAt: new Date().toISOString(),
  parts: [...current.parts, ...buildcoresParts],
};
let sql = buildSeedSql(merged);
try {
  const jevOverrides = await readFile(jevOverridesPath, "utf8");
  sql += `\n${jevOverrides}`;
  console.log(`Included Jev GPU dimension overrides from ${jevOverridesPath}.`);
} catch {
  // Optional review output; a clean promotion remains valid without it.
}
console.log(`Prepared merged seed with ${current.parts.length} existing and ${buildcoresParts.length} BuildCores records.`);
console.log(`Wrote ${outputPath}`);
