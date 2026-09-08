import ExcelJS from "exceljs";
import { fetchPsuTierEntries } from "./psu-tier-list";
import type {
  AvailabilityStatus,
  CasePart,
  GenericPart,
  GpuPart,
  IntakeResult,
  PartKind,
  RawSheetRow,
} from "../types";

const SHEET_ID = "1AddRvGWJ_f4B6UC7_IftDiVudVc8CJ8sxLUqlxVsCz4";

export const SFF_SHEETS = {
  cases: ["SFF Case <10L", "SFF Case 10L-20L"],
  gpus: ["SFF GPU <215mm", "GPU >215mm"],
} as const;

export const SFF_INDEX_SHEET = "Sheets";

function sheetXlsxUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
}

function stableId(parts: Array<string | number | null | undefined>) {
  return parts
    .filter(
      (part) => part !== null && part !== undefined && `${part}`.trim() !== "",
    )
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

// These are workbook classifications, not guesses from a board's product name.
// Keep this map explicit as the workbook's sheet names evolve.
const MOTHERBOARD_SOURCE_SHEET_FORM_FACTORS: Record<string, string> = {
  mITX: "mITX",
  mATX: "mATX",
  "Motherboard mITX": "mITX",
  "Motherboard mATX": "mATX",
};

function isUnknown(value: string) {
  return UNKNOWN_VALUES.has(value.trim().toLowerCase());
}

function isYes(value: string) {
  return ["y", "yes", "true", "1"].includes(value.trim().toLowerCase());
}

function normalizeAvailabilityStatus(raw: string | null | undefined): AvailabilityStatus {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (!normalized) return "available";
  if (/^(available|active|in stock|current|link)$/.test(normalized)) return "available";
  if (
    /discontinued|unavailable|retired|obsolete/.test(normalized) ||
    /out\s*of\s*(stock|production)/.test(normalized) ||
    /no\s*longer\s*(available|made|sold)/.test(normalized) ||
    /end\s+of\s+life|\beol\b/.test(normalized)
  ) {
    return "unavailable";
  }
  return "available";
}

function parseYear(value: string): number | null {
  const normalized = value.trim();
  if (isUnknown(normalized)) return null;
  const match = normalized.match(/^\d{4}$/);
  return match ? Number(match[0]) : null;
}

function extractReleaseYear(values: Record<string, string>): number | null {
  for (const [key, value] of Object.entries(values)) {
    const lower = key.toLowerCase();
    if (lower === "year" || lower === "release" || lower === "release year") {
      const year = parseYear(value);
      if (year !== null) return year;
    }
  }
  return null;
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
  if (name.includes("case") || name.includes("recommended components"))
    return "case";
  if (name.includes("gpu")) return "gpu";
  if (name.includes("cpu cooler") || name.includes("thermalright"))
    return "cpu-cooler";
  if (name === "aio") return "aio";
  if (name.includes("fan")) return "fan";
  if (name.includes("ram")) return "ram";
  if (name.includes("riser")) return "pcie-riser";
  if (name.includes("board") || name.includes("motherboard"))
    return "motherboard";
  if (name === "psu") return "psu";
  if (name === "cpu") return "cpu";
  if (name.includes("chipset")) return "chipset";
  if (name.includes("wi-fi")) return "wifi";
  if (name.includes("ssd")) return "storage";
  if (name.includes("radiator")) return "radiator";
  if (name.includes("console") || name.includes("pre-built")) return "prebuilt";
  if (name.includes("taobao")) return "reference";
  return "unknown";
}

function firstCell(values: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = cell(values, key);
    if (value) return value;
  }
  return "";
}

function firstLink(links: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = links[key]?.trim();
    if (value) return value;
  }
  return "";
}

function firstNonEmptyValue(values: Record<string, string>) {
  return (
    Object.values(values)
      .find((value) => value.trim())
      ?.trim() ?? ""
  );
}

function normalizeSpecKey(key: string) {
  const trimmedKey = key.trim();
  const loweredKey = trimmedKey.toLowerCase();

  if (/^size\s*\(height\)/.test(loweredKey)) return "size_height";
  if (/^size\s*\(width\)/.test(loweredKey)) return "size_width";

  return trimmedKey
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeGenericPart(raw: RawSheetRow): GenericPart {
  const values = raw.values;
  const links = raw.links;
  const kind = partKindFromSheet(raw.sourceSheet);
  const brandKeys = ["Brand", "Seller", "Manufacturer", "Make", "Company"];
  const nameKeys = [
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
    "SSD",
  ];
  const brand = firstCell(values, brandKeys);
  const name = firstCell(values, nameKeys);
  const fallbackName = firstNonEmptyValue(values);
  const displayName = [brand, name || fallbackName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const status = firstCell(values, ["Status", "Availability"]);
  const sellerUrl = firstLink(links, brandKeys);
  const productUrl = firstLink(links, nameKeys);
  const specs = Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [normalizeSpecKey(key), value.trim()] as const)
      .filter(([key, value]) => key && value),
  );
  if (kind === "motherboard") {
    const formFactor = MOTHERBOARD_SOURCE_SHEET_FORM_FACTORS[raw.sourceSheet];
    if (formFactor) specs.form_factor = formFactor;
  }
  const dimensions = Object.fromEntries(
    Object.entries(values)
      .map(
        ([key, value]) => [normalizeSpecKey(key), parseNumber(value)] as const,
      )
      .filter(
        ([key, value]) =>
          key &&
          value !== null &&
          /height|length|width|thick|volume|size|slot|watt|tdp|clearance|depth|diameter|capacity/.test(
            key,
          ),
      ),
  ) as Record<string, number>;
  const flags = Object.entries(values)
    .filter(([key, value]) => {
      const normalized = value.trim().toLowerCase();
      return (
        key.trim() &&
        (isUnknown(normalized) ||
          normalized.includes("~") ||
          normalized.includes("?"))
      );
    })
    .map(([key]) => `ambiguous:${normalizeSpecKey(key)}`);

  if (!displayName) flags.push("missing-name");
  if (status && !["link", "available"].includes(status.toLowerCase()))
    flags.push(`status:${status.toLowerCase()}`);

  return {
    id: stableId([
      "part",
      kind,
      raw.sourceSheet,
      brand,
      name || fallbackName,
      raw.rowNumber,
    ]),
    kind,
    sourceSheet: raw.sourceSheet,
    rowNumber: raw.rowNumber,
    brand,
    name: name || fallbackName,
    displayName,
    status,
    availabilityStatus: normalizeAvailabilityStatus(status),
    sellerUrl,
    productUrl,
    releaseYear: extractReleaseYear(values),
    specs,
    dimensions,
    flags,
    raw: values,
    links,
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
    "CPU Cooler Height (mm)",
  ]);

  const hasExplicitGpuBay =
    parseNumber(gpuLengthRaw) !== null || parseSlots(pcieSlotRaw) !== null;
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
    sidePanel: cell(values, "Side panel"),
    caseMaterial: cell(values, "Case material"),
    status,
    availabilityStatus: normalizeAvailabilityStatus(status),
    gpuRiser,
    psu: cell(values, "PSU"),
    motherboard: cell(values, "Motherboard"),
    radiatorSupportRaw: cell(values, "Radiator support"),
    sffNetLink: cell(values, "SFF.Net link"),
    lastUpdate: cell(values, "Last update"),
    dimensions: {
      lengthMm: parseNumber(cell(values, "Case Length (mm)")),
      widthMm: parseNumber(cell(values, "Case Width (mm)")),
      heightMm: parseNumber(cell(values, "Case Height (mm)")),
      volumeL: parseNumber(cell(values, "Volume (L)")),
      footprintCm2: parseNumber(cell(values, "Footprint (cm2)")),
      weightKg: parseNumber(cell(values, "Weight (kg)")),
      cpuCoolerHeightMm: parseNumber(cell(values, "CPU Cooler Height (mm)")),
      gpuLengthMm: parseNumber(gpuLengthRaw),
      gpuWidthMm: parseNumber(cell(values, "GPU Width (mm)")),
      gpuThicknessMm: parseNumber(cell(values, "GPU Height / Thickness (mm)")),
      pcieSlots: parseSlots(pcieSlotRaw),
      lpPcieSlots: parseSlots(lpSlotRaw),
    },
    counts: {
      drive25Max: parseNumber(cell(values, '2.5" drive count')),
      drive35Max: parseNumber(cell(values, '3.5" drive count')),
      drive525Max: parseNumber(cell(values, '5.25" drive count')),
      fan40mm: parseNumber(cell(values, "40mm fan count")),
      fan60mm: parseNumber(cell(values, "60mm fan count")),
      fan80mm: parseNumber(cell(values, "80mm fan count")),
      fan92mm: parseNumber(cell(values, "92mm fan count")),
      fan120mm: parseNumber(cell(values, "120mm fan count")),
      fan140mm: parseNumber(cell(values, "140mm fan count")),
      fan180mm: parseNumber(cell(values, "180mm fan count")),
      fan200mm: parseNumber(cell(values, "200mm fan count")),
      usbA20: parseNumber(cell(values, "USB-A 2.0 count")),
      usbA32: parseNumber(cell(values, "USB-A 3.2 count")),
      usbC: parseNumber(cell(values, "USB-C count")),
    },
    radiatorFlags: {
      has120mm: isYes(cell(values, "Radiator 120mm")),
      has140mm: isYes(cell(values, "Radiator 140mm")),
      has200mm: isYes(cell(values, "Radiator 200mm")),
      has240mm: isYes(cell(values, "Radiator 240mm")),
      has280mm: isYes(cell(values, "Radiator 280mm")),
      has360mm: isYes(cell(values, "Radiator 360mm")),
      has420mm: isYes(cell(values, "Radiator 420mm")),
      hasTopHat: isYes(cell(values, "Radiator top hat")),
    },
    hasJack35mm: isYes(cell(values, "3.5mm jack")),
    priceCny: parseNumber(cell(values, "Price (CNY)")),
    priceUsd: parseNumber(cell(values, "Price (USD)")),
    releaseYear: extractReleaseYear(values),
    flags,
    raw: values,
  };
}

function normalizeGpu(raw: RawSheetRow): GpuPart {
  const values = raw.values;
  const watercooled = isYes(cell(values, "Watercooled"));
  const lowProfile = isYes(cell(values, "Low Profile"));
  const pciePins = cell(values, "PCIe Pins");
  const status = firstCell(values, ["Status", "Availability"]);
  const flags = dimensionFlags(values, [
    "Length (mm)",
    "Width (mm)",
    "Thickness (mm)",
    "PCIe Bracket",
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
      raw.rowNumber,
    ]),
    sourceSheet: raw.sourceSheet,
    rowNumber: raw.rowNumber,
    chipset: cell(values, "GPU"),
    model: cell(values, "Model"),
    brand: cell(values, "Brand"),
    name: cell(values, "Name"),
    lowProfile,
    watercooled,
    blower: isYes(cell(values, "Blower")),
    pciePins,
    tdpW: parseNumber(cell(values, "TDP (W)")),
    boostClockMhz: parseNumber(cell(values, "Boost Clock (MHz)")),
    memorySpeedGbps: parseNumber(cell(values, "Memory Speed (Gbps)")),
    fanCount: parseNumber(cell(values, "Fan Count")),
    displayportCount: parseNumber(cell(values, "DisplayPort Count")),
    hdmiCount: parseNumber(cell(values, "HDMI Count")),
    usbCCount: parseNumber(cell(values, "USB-C Count")),
    dviD: isYes(cell(values, "DVI-D")),
    remarks: cell(values, "Remarks"),
    availabilityStatus: normalizeAvailabilityStatus(status),
    releaseYear: extractReleaseYear(values),
    dimensions: {
      lengthMm: parseNumber(cell(values, "Length (mm)")),
      widthMm: parseNumber(cell(values, "Width (mm)")),
      thicknessMm: parseNumber(cell(values, "Thickness (mm)")),
      pcieSlots: parseSlots(cell(values, "PCIe Bracket")),
    },
    flags,
    raw: values,
  };
}

function cellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("text" in value && typeof value.text === "string")
      return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text ?? "")
        .join("")
        .trim();
    }
    if (
      "result" in value &&
      value.result !== undefined &&
      value.result !== null
    ) {
      return String(value.result).trim();
    }
  }
  return String(cell.text ?? "").trim();
}

function hyperlinkFromFormula(formula: string) {
  const match = formula.match(/HYPERLINK\(\s*"([^"]+)"/i);
  return match?.[1] ?? "";
}

function cellLink(cell: ExcelJS.Cell) {
  if (cell.hyperlink) return cell.hyperlink;
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("hyperlink" in value && typeof value.hyperlink === "string")
      return value.hyperlink;
    if ("formula" in value && typeof value.formula === "string")
      return hyperlinkFromFormula(value.formula);
    if ("richText" in value && Array.isArray(value.richText)) {
      const linkedPart = value.richText.find(
        (part) => "hyperlink" in part && typeof part.hyperlink === "string",
      );
      if (
        linkedPart &&
        "hyperlink" in linkedPart &&
        typeof linkedPart.hyperlink === "string"
      )
        return linkedPart.hyperlink;
    }
  }
  return "";
}

function rowsFromWorksheet(
  sheetName: string,
  worksheet: ExcelJS.Worksheet,
): RawSheetRow[] {
  const headerRow = worksheet.getRow(1);
  const headers = Array.from({ length: worksheet.columnCount }, (_, index) =>
    cellText(headerRow.getCell(index + 1)),
  );
  const rows: RawSheetRow[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: Record<string, string> = {};
    const links: Record<string, string> = {};

    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      const value = cellText(cell);
      const link = cellLink(cell);
      values[header] = value;
      if (link) links[header] = link;
    });

    if (Object.values(values).some((value) => value.trim())) {
      rows.push({ sourceSheet: sheetName, rowNumber, values, links });
    }
  }

  return rows;
}

async function fetchWorkbookRows(): Promise<RawSheetRow[]> {
  const response = await fetch(sheetXlsxUrl());
  if (!response.ok) {
    throw new Error(
      `Failed to fetch SFF workbook: ${response.status} ${response.statusText}`,
    );
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());

  return workbook.worksheets
    .filter((worksheet) => worksheet.name !== SFF_INDEX_SHEET)
    .flatMap((worksheet) => rowsFromWorksheet(worksheet.name, worksheet));
}

export async function fetchAndNormalizeAll(): Promise<IntakeResult> {
  const warnings: string[] = [];
  const rawRows = await fetchWorkbookRows().catch((error) => {
    warnings.push(error instanceof Error ? error.message : String(error));
    return [];
  });
  const psuTierEntries = await fetchPsuTierEntries().catch((error) => {
    warnings.push(error instanceof Error ? error.message : String(error));
    return [];
  });
  const rawCaseRows = rawRows.filter((row) =>
    (SFF_SHEETS.cases as readonly string[]).includes(row.sourceSheet),
  );
  const rawGpuRows = rawRows.filter((row) =>
    (SFF_SHEETS.gpus as readonly string[]).includes(row.sourceSheet),
  );

  return {
    generatedAt: new Date().toISOString(),
    rawRows,
    parts: rawRows.map(normalizeGenericPart).filter((part) => part.displayName),
    cases: rawCaseRows.map(normalizeCase).filter((part) => part.name),
    gpus: rawGpuRows
      .map(normalizeGpu)
      .filter((part) => part.model || part.name),
    psuTierEntries,
    warnings,
  };
}
