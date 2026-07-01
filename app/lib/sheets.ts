import { parse } from "csv-parse/sync";
import type { CasePart, GenericPart, GpuPart, IntakeResult, PartKind, RawSheetRow } from "../types";

const SHEET_ID = "1AddRvGWJ_f4B6UC7_IftDiVudVc8CJ8sxLUqlxVsCz4";

export const SFF_SHEETS = {
  cases: ["SFF Case <10L", "SFF Case 10L-20L"],
  gpus: ["SFF GPU <215mm", "GPU >215mm"]
} as const;

export const SFF_V1_SHEETS = [
  "SFF Case <10L",
  "SFF Case 10L-20L",
  "MFF Case >20L",
  "CPU Cooler <70mm",
  "CPU Cooler >70mm",
  "AIO",
  "Slim Fan",
  "Fans",
  "RAM Height",
  "PCIe Riser",
  "SFF GPU <215mm",
  "GPU >215mm",
  "GPU Spec",
  "mITX Boards",
  "mATX Boards",
  "PSU",
  "CPU",
  "Chipset",
  "Wi-Fi",
  "Console & Pre-Built",
  "SSD",
  "CPU Cooler Chart",
  "Thermalright Coolers & Fans",
  "Radiators",
  "Recommended Components for SFF Cases",
  "1151 v2 Motherboard List",
  "AM4 Motherboard List",
  "VLP RAM"
] as const;

function sheetCsvUrl(sheetName: string) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

function stableId(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && `${part}`.trim() !== "")
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cell(row: Record<string, string>, key: string) {
  return (row[key] ?? "").trim();
}

const UNKNOWN_VALUES = new Set(["", "-", "?", "tbd", "n/a", "na"]);

function isUnknown(value: string) {
  return UNKNOWN_VALUES.has(value.trim().toLowerCase());
}

function isYes(value: string) {
  return ["y", "yes", "true", "1"].includes(value.trim().toLowerCase());
}

export function parseNumber(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (isUnknown(normalized) || normalized === "open") return null;
  const match = normalized.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseSlots(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (isUnknown(normalized) || normalized === "open") return null;
  const range = normalized.match(/(\d+(\.\d+)?)\s*(to|-)\s*(\d+(\.\d+)?)/);
  if (range) return Number(range[4]);
  return parseNumber(normalized);
}

function dimensionFlags(values: Record<string, string>, keys: string[]) {
  return keys
    .filter((key) => {
      const value = cell(values, key).toLowerCase();
      return isUnknown(value) || value.includes("~");
    })
    .map((key) => `ambiguous:${key}`);
}

function partKindFromSheet(sheetName: string): PartKind {
  const name = sheetName.toLowerCase();
  if (name.includes("case") || name.includes("recommended components")) return "case";
  if (name.includes("gpu")) return "gpu";
  if (name.includes("cpu cooler") || name.includes("thermalright")) return "cpu-cooler";
  if (name === "aio") return "aio";
  if (name.includes("fan")) return "fan";
  if (name.includes("ram")) return "ram";
  if (name.includes("riser")) return "pcie-riser";
  if (name.includes("board") || name.includes("motherboard")) return "motherboard";
  if (name === "psu") return "psu";
  if (name === "cpu") return "cpu";
  if (name.includes("chipset")) return "chipset";
  if (name.includes("wi-fi")) return "wifi";
  if (name.includes("ssd")) return "storage";
  if (name.includes("radiator")) return "radiator";
  if (name.includes("console") || name.includes("pre-built")) return "prebuilt";
  return "unknown";
}

function firstCell(values: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = cell(values, key);
    if (value) return value;
  }
  return "";
}

function firstNonEmptyValue(values: Record<string, string>) {
  return Object.values(values).find((value) => value.trim())?.trim() ?? "";
}

function normalizeSpecKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeGenericPart(raw: RawSheetRow): GenericPart {
  const values = raw.values;
  const kind = partKindFromSheet(raw.sourceSheet);
  const brand = firstCell(values, ["Brand", "Seller", "Manufacturer", "Make", "Company"]);
  const name = firstCell(values, [
    "Name",
    "Model",
    "Case",
    "Cooler",
    "Fan",
    "RAM",
    "Riser",
    "Motherboard",
    "PSU",
    "CPU",
    "GPU",
    "Chipset",
    "SSD"
  ]);
  const fallbackName = firstNonEmptyValue(values);
  const displayName = [brand, name || fallbackName].filter(Boolean).join(" ").trim();
  const status = firstCell(values, ["Status", "Availability"]);
  const specs = Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [normalizeSpecKey(key), value.trim()] as const)
      .filter(([key, value]) => key && value)
  );
  const dimensions = Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [normalizeSpecKey(key), parseNumber(value)] as const)
      .filter(([key, value]) => key && value !== null && /height|length|width|thick|volume|size|slot|watt|tdp|clearance|depth|diameter|capacity/.test(key))
  ) as Record<string, number>;
  const flags = Object.entries(values)
    .filter(([key, value]) => {
      const normalized = value.trim().toLowerCase();
      return key.trim() && (isUnknown(normalized) || normalized.includes("~") || normalized.includes("?"));
    })
    .map(([key]) => `ambiguous:${normalizeSpecKey(key)}`);

  if (!displayName) flags.push("missing-name");
  if (status && !["link", "available"].includes(status.toLowerCase())) flags.push(`status:${status.toLowerCase()}`);

  return {
    id: stableId(["part", kind, raw.sourceSheet, brand, name || fallbackName, raw.rowNumber]),
    kind,
    sourceSheet: raw.sourceSheet,
    rowNumber: raw.rowNumber,
    brand,
    name: name || fallbackName,
    displayName,
    status,
    specs,
    dimensions,
    flags,
    raw: values
  };
}

function normalizeCase(raw: RawSheetRow): CasePart {
  const values = raw.values;
  const seller = cell(values, "Seller");
  const name = cell(values, "Case");
  const style = cell(values, "Style");
  const status = cell(values, "Status");
  const gpuRiser = cell(values, "GPU Riser");
  const gpuLengthRaw = cell(values, "GPU Length (mm)");
  const pcieSlotRaw = cell(values, "PCIe Slot");
  const lpSlotRaw = cell(values, "LP PCIe Slot");
  const flags = dimensionFlags(values, [
    "GPU Length (mm)",
    "GPU Width (mm)",
    "GPU Height / Thickness (mm)",
    "PCIe Slot",
    "LP PCIe Slot",
    "CPU Cooler Height (mm)"
  ]);

  const hasExplicitGpuBay = parseNumber(gpuLengthRaw) !== null || parseSlots(pcieSlotRaw) !== null;
  if (!hasExplicitGpuBay || style.toLowerCase() === "apu") {
    flags.push("possibly-no-discrete-gpu-support");
  }
  if (parseSlots(lpSlotRaw) !== null && parseSlots(pcieSlotRaw) === null) {
    flags.push("low-profile-only");
  }
  if (style.toLowerCase() === "sandwich") {
    flags.push("sandwich-layout");
  }
  if (gpuRiser.toLowerCase() === "y") {
    flags.push("requires-riser");
  }
  if (gpuRiser.toLowerCase() === "optional") {
    flags.push("riser-optional");
  }
  if (status && !["", "link"].includes(status.toLowerCase())) {
    flags.push(`status:${status.toLowerCase()}`);
  }

  return {
    kind: "case",
    id: stableId(["case", raw.sourceSheet, seller, name, raw.rowNumber]),
    sourceSheet: raw.sourceSheet,
    rowNumber: raw.rowNumber,
    seller,
    name,
    style,
    status,
    gpuRiser,
    psu: cell(values, "PSU"),
    dimensions: {
      lengthMm: parseNumber(cell(values, "Case Length (mm)")),
      widthMm: parseNumber(cell(values, "Case Width (mm)")),
      heightMm: parseNumber(cell(values, "Case Height (mm)")),
      volumeL: parseNumber(cell(values, "Volume (L)")),
      cpuCoolerHeightMm: parseNumber(cell(values, "CPU Cooler Height (mm)")),
      gpuLengthMm: parseNumber(gpuLengthRaw),
      gpuWidthMm: parseNumber(cell(values, "GPU Width (mm)")),
      gpuThicknessMm: parseNumber(cell(values, "GPU Height / Thickness (mm)")),
      pcieSlots: parseSlots(pcieSlotRaw),
      lpPcieSlots: parseSlots(lpSlotRaw)
    },
    flags,
    raw: values
  };
}

function normalizeGpu(raw: RawSheetRow): GpuPart {
  const values = raw.values;
  const watercooled = isYes(cell(values, "Watercooled"));
  const lowProfile = isYes(cell(values, "Low Profile"));
  const pciePins = cell(values, "PCIe Pins");
  const flags = dimensionFlags(values, [
    "Length (mm)",
    "Width (mm)",
    "Thickness (mm)",
    "PCIe Bracket"
  ]);

  if (watercooled) flags.push("watercooled");
  if (lowProfile) flags.push("low-profile");
  if (pciePins && pciePins !== "-") flags.push("external-power");

  return {
    kind: "gpu",
    id: stableId([
      "gpu",
      raw.sourceSheet,
      cell(values, "GPU"),
      cell(values, "Model"),
      cell(values, "Brand"),
      cell(values, "Name"),
      raw.rowNumber
    ]),
    sourceSheet: raw.sourceSheet,
    rowNumber: raw.rowNumber,
    chipset: cell(values, "GPU"),
    model: cell(values, "Model"),
    brand: cell(values, "Brand"),
    name: cell(values, "Name"),
    lowProfile,
    watercooled,
    pciePins,
    tdpW: parseNumber(cell(values, "TDP (W)")),
    dimensions: {
      lengthMm: parseNumber(cell(values, "Length (mm)")),
      widthMm: parseNumber(cell(values, "Width (mm)")),
      thicknessMm: parseNumber(cell(values, "Thickness (mm)")),
      pcieSlots: parseSlots(cell(values, "PCIe Bracket"))
    },
    flags,
    raw: values
  };
}

async function fetchSheet(sheetName: string): Promise<RawSheetRow[]> {
  const response = await fetch(sheetCsvUrl(sheetName));
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sheetName}: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  const records = parse(csv, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true
  }) as Record<string, string>[];

  return records.map((values, index) => ({
    sourceSheet: sheetName,
    rowNumber: index + 2,
    values
  }));
}

export async function fetchAndNormalizeAll(): Promise<IntakeResult> {
  const warnings: string[] = [];
  const allSheetRows = await Promise.all(
    SFF_V1_SHEETS.map(async (sheetName) => {
      try {
        return await fetchSheet(sheetName);
      } catch (error) {
        warnings.push(`Failed to fetch ${sheetName}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    })
  );
  const rawRows = allSheetRows.flat();
  const rawCaseRows = rawRows.filter((row) => (SFF_SHEETS.cases as readonly string[]).includes(row.sourceSheet));
  const rawGpuRows = rawRows.filter((row) => (SFF_SHEETS.gpus as readonly string[]).includes(row.sourceSheet));

  return {
    generatedAt: new Date().toISOString(),
    rawRows,
    parts: rawRows.map(normalizeGenericPart).filter((part) => part.displayName),
    cases: rawCaseRows.map(normalizeCase).filter((part) => part.name),
    gpus: rawGpuRows.map(normalizeGpu).filter((part) => part.model || part.name),
    warnings
  };
}
