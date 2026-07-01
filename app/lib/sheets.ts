import { parse } from "csv-parse/sync";
import type { CasePart, GpuPart, IntakeResult, RawSheetRow } from "../types";

const SHEET_ID = "1AddRvGWJ_f4B6UC7_IftDiVudVc8CJ8sxLUqlxVsCz4";

export const SFF_SHEETS = {
  cases: ["SFF Case <10L", "SFF Case 10L-20L"],
  gpus: ["SFF GPU <215mm", "GPU >215mm"]
} as const;

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
  const [caseRows, gpuRows] = await Promise.all([
    Promise.all(SFF_SHEETS.cases.map(fetchSheet)),
    Promise.all(SFF_SHEETS.gpus.map(fetchSheet))
  ]);

  const rawCaseRows = caseRows.flat();
  const rawGpuRows = gpuRows.flat();

  return {
    generatedAt: new Date().toISOString(),
    rawRows: [...rawCaseRows, ...rawGpuRows],
    cases: rawCaseRows.map(normalizeCase).filter((part) => part.name),
    gpus: rawGpuRows.map(normalizeGpu).filter((part) => part.model || part.name),
    warnings: []
  };
}
