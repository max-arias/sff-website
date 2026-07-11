import type { APIContext } from "astro";
import {
  buildUrl,
  parseBuildQuery,
  slotOrder,
  tabOrder,
  type BuildQueryState,
  type SelectableKind,
} from "../lib/build-state";
import { checkCaseGpuCompatibility } from "../lib/compatibility";
import {
  loadCatalog,
  loadCatalogPartsByIds,
  loadParts,
  searchCatalog,
} from "./d1";
import type { CasePart, FitVerdict, GenericPart, GpuPart } from "../types";

type PartRecord = GenericPart | CasePart | GpuPart;
type DisplayVerdict = FitVerdict | "unscored";
type BuildStatus = FitVerdict | "in-progress";
type FitmentCheck = {
  verdict: DisplayVerdict;
  message: string;
  cellIndex?: number;
  advisory?: boolean;
};
type FitmentSummary = {
  verdict: DisplayVerdict;
  messages: string[];
  notes: string[];
  highlightCellIndex: number | null;
};
type SlotSpec = {
  label: string;
  value: string;
};

export interface BuildViewSlot {
  kind: SelectableKind;
  label: string;
  actionLabel: string;
  id: string;
  state: "resolved" | "unresolved";
  title: string;
  subtitle: string;
  note: string;
  verdict: DisplayVerdict;
  verdictCopy: string;
  verdictTooltip: string;
  specs: SlotSpec[];
  clearUrl: string;
  browseUrl: string;
}

export interface BuildViewRow {
  id: string;
  kind: SelectableKind;
  title: string;
  subtitle: string;
  cells: string[];
  verdict: DisplayVerdict;
  verdictLabel: string;
  verdictTooltip: string;
  note: string;
  selected: boolean;
  actionLabel: string;
  actionTone: "add" | "remove" | "swap";
  actionUrl: string;
  highlightCellIndex: number | null;
  releaseYear: number | null;
  mobileMetrics: Array<{ label: string; value: string; alert: boolean }>;
}

export interface BuildViewTableHeader {
  key: string;
  label: string;
  sortable: boolean;
  sortUrl: string;
  sortDir: "asc" | "desc" | null;
}

export interface BuildViewNumericFilter {
  name: string;
  label: string;
  unit: string;
  max: number;
  step: number;
  value: number;
  active: boolean;
  group: string;
}

export interface BuildViewNumericFilterGroup {
  label: string;
  filters: BuildViewNumericFilter[];
  activeCount: number;
  summary: string;
}

export interface BuildView {
  state: BuildQueryState;
  slotOrder: typeof slotOrder;
  tabOrder: typeof tabOrder;
  slots: BuildViewSlot[];
  buildStatus: BuildStatus;
  buildStatusLabel: string;
  buildStatusCopy: string;
  buildIssues: Array<{ kind: SelectableKind; label: string; issues: string[] }>;
  activeConstraintLabel: string;
  constraintMeters: Array<{
    label: string;
    value: string;
    tone: "pass" | "conditional" | "neutral";
    ratio: number;
  }>;
  kindTabs: Array<{ kind: SelectableKind; href: string; active: boolean }>;
  searchAction: string;
  hiddenInputs: Array<{ name: string; value: string }>;
  numericFilters: BuildViewNumericFilter[];
  numericFilterGroups: BuildViewNumericFilterGroup[];
  clearFiltersUrl: string;
  tableHeaders: BuildViewTableHeader[];
  rows: BuildViewRow[];
  totalRows: number;
  displayStart: number;
  displayEnd: number;
  pageCount: number;
  previousUrl: string;
  nextUrl: string;
  psuTierSourceUrl: string;
  activeFilterChips: Array<{
    label: string;
    href: string;
    tone?: "neutral" | "active";
  }>;
  tableNotice: string;
}

// ---------------------------------------------------------------------------
// Column descriptor metadata – drives table headers, metric cells, and numeric filters
// ---------------------------------------------------------------------------

interface NumericFilterDef {
  paramKey: string;
  unit: string;
  rawValue: (part: PartRecord) => number | null;
}

interface MetricColumnDef {
  key: string;
  label: string;
  getValue: (part: PartRecord) => string;
  numericFilter?: NumericFilterDef;
}

function cVal<R>(part: PartRecord, fn: (c: CasePart) => R, fallback: R): R {
  return isCasePart(part) ? fn(part) : fallback;
}

function gVal<R>(part: PartRecord, fn: (g: GpuPart) => R, fallback: R): R {
  return isGpuPart(part) ? fn(part) : fallback;
}

const CASE_COLUMNS: MetricColumnDef[] = [
  {
    key: "style",
    label: "Style",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.style), "—"),
  },
  {
    key: "side-panel",
    label: "Side panel",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.sidePanel), "—"),
  },
  {
    key: "material",
    label: "Material",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.caseMaterial), "—"),
  },
  {
    key: "length",
    label: "Length",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.lengthMm, "mm"), "—"),
    numericFilter: {
      paramKey: "case-max-length-mm",
      unit: "mm",
      rawValue: (p) => cVal(p, (c) => c.dimensions.lengthMm, null),
    },
  },
  {
    key: "width",
    label: "Width",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.widthMm, "mm"), "—"),
    numericFilter: {
      paramKey: "case-max-width-mm",
      unit: "mm",
      rawValue: (p) => cVal(p, (c) => c.dimensions.widthMm, null),
    },
  },
  {
    key: "height",
    label: "Height",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.heightMm, "mm"), "—"),
    numericFilter: {
      paramKey: "case-max-height-mm",
      unit: "mm",
      rawValue: (p) => cVal(p, (c) => c.dimensions.heightMm, null),
    },
  },
  {
    key: "volume",
    label: "Volume",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.volumeL, "L"), "—"),
    numericFilter: {
      paramKey: "case-max-volume-l",
      unit: "L",
      rawValue: (p) => cVal(p, (c) => c.dimensions.volumeL, null),
    },
  },
  {
    key: "footprint",
    label: "Footprint",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.footprintCm2, "cm²"), "—"),
    numericFilter: {
      paramKey: "case-max-footprint-cm2",
      unit: "cm²",
      rawValue: (p) => cVal(p, (c) => c.dimensions.footprintCm2, null),
    },
  },
  {
    key: "weight",
    label: "Weight",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.weightKg, "kg"), "—"),
    numericFilter: {
      paramKey: "case-max-weight-kg",
      unit: "kg",
      rawValue: (p) => cVal(p, (c) => c.dimensions.weightKg, null),
    },
  },
  {
    key: "cpu-cooler-height",
    label: "CPU cooler H",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.cpuCoolerHeightMm, "mm"), "—"),
    numericFilter: {
      paramKey: "case-max-cpu-cooler-height-mm",
      unit: "mm",
      rawValue: (p) => cVal(p, (c) => c.dimensions.cpuCoolerHeightMm, null),
    },
  },
  {
    key: "gpu-length",
    label: "GPU max L",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.gpuLengthMm, "mm"), "—"),
    numericFilter: {
      paramKey: "case-max-gpu-length-mm",
      unit: "mm",
      rawValue: (p) => cVal(p, (c) => c.dimensions.gpuLengthMm, null),
    },
  },
  {
    key: "gpu-width",
    label: "GPU max W",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.gpuWidthMm, "mm"), "—"),
  },
  {
    key: "gpu-thickness",
    label: "GPU max T",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.gpuThicknessMm, "mm"), "—"),
    numericFilter: {
      paramKey: "case-max-gpu-thickness-mm",
      unit: "mm",
      rawValue: (p) => cVal(p, (c) => c.dimensions.gpuThicknessMm, null),
    },
  },
  {
    key: "pcie-slots",
    label: "PCIe slots",
    getValue: (p) => cVal(p, (c) => formatValue(c.dimensions.pcieSlots), "—"),
    numericFilter: {
      paramKey: "case-max-pcie-slots",
      unit: "slots",
      rawValue: (p) => cVal(p, (c) => c.dimensions.pcieSlots, null),
    },
  },
  {
    key: "lp-pcie-slots",
    label: "LP slots",
    getValue: (p) => cVal(p, (c) => formatValue(c.dimensions.lpPcieSlots), "—"),
    numericFilter: {
      paramKey: "case-max-lp-pcie-slots",
      unit: "slots",
      rawValue: (p) => cVal(p, (c) => c.dimensions.lpPcieSlots, null),
    },
  },
  {
    key: "riser",
    label: "Riser",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.gpuRiser), "—"),
  },
  {
    key: "motherboard",
    label: "Motherboard",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.motherboard), "—"),
  },
  {
    key: "psu",
    label: "PSU",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.psu), "—"),
  },
  {
    key: "radiator",
    label: "Radiators",
    getValue: (p) =>
      cVal(
        p,
        (c) => {
          const sizes = [];
          if (c.radiatorFlags.has120mm) sizes.push("120");
          if (c.radiatorFlags.has140mm) sizes.push("140");
          if (c.radiatorFlags.has200mm) sizes.push("200");
          if (c.radiatorFlags.has240mm) sizes.push("240");
          if (c.radiatorFlags.has280mm) sizes.push("280");
          if (c.radiatorFlags.has360mm) sizes.push("360");
          if (c.radiatorFlags.has420mm) sizes.push("420");
          if (c.radiatorFlags.hasTopHat) sizes.push("top-hat");
          return sizes.length ? sizes.join(", ") : "—";
        },
        "—",
      ),
  },
  {
    key: "radiator-support-raw",
    label: "Rad support raw",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.radiatorSupportRaw), "—"),
  },
  {
    key: "drives-25",
    label: '2.5" bays',
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.drive25Max), "—"),
  },
  {
    key: "drives-35",
    label: '3.5" bays',
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.drive35Max), "—"),
  },
  {
    key: "drives-525",
    label: '5.25" bays',
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.drive525Max), "—"),
  },
  {
    key: "fan-40",
    label: "40mm fans",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.fan40mm), "—"),
    numericFilter: {
      paramKey: "case-max-fan-40",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.fan40mm, null),
    },
  },
  {
    key: "fan-60",
    label: "60mm fans",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.fan60mm), "—"),
    numericFilter: {
      paramKey: "case-max-fan-60",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.fan60mm, null),
    },
  },
  {
    key: "fan-80",
    label: "80mm fans",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.fan80mm), "—"),
    numericFilter: {
      paramKey: "case-max-fan-80",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.fan80mm, null),
    },
  },
  {
    key: "fan-92",
    label: "92mm fans",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.fan92mm), "—"),
    numericFilter: {
      paramKey: "case-max-fan-92",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.fan92mm, null),
    },
  },
  {
    key: "fan-120",
    label: "120mm fans",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.fan120mm), "—"),
    numericFilter: {
      paramKey: "case-max-fan-120",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.fan120mm, null),
    },
  },
  {
    key: "fan-140",
    label: "140mm fans",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.fan140mm), "—"),
    numericFilter: {
      paramKey: "case-max-fan-140",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.fan140mm, null),
    },
  },
  {
    key: "fan-180",
    label: "180mm fans",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.fan180mm), "—"),
    numericFilter: {
      paramKey: "case-max-fan-180",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.fan180mm, null),
    },
  },
  {
    key: "fan-200",
    label: "200mm fans",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.fan200mm), "—"),
    numericFilter: {
      paramKey: "case-max-fan-200",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.fan200mm, null),
    },
  },
  {
    key: "usb-a20",
    label: "USB-A 2.0",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.usbA20), "—"),
    numericFilter: {
      paramKey: "case-max-usb-a20",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.usbA20, null),
    },
  },
  {
    key: "usb-a32",
    label: "USB-A 3.2",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.usbA32), "—"),
    numericFilter: {
      paramKey: "case-max-usb-a32",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.usbA32, null),
    },
  },
  {
    key: "usb-c",
    label: "USB-C",
    getValue: (p) => cVal(p, (c) => formatValue(c.counts.usbC), "—"),
    numericFilter: {
      paramKey: "case-max-usb-c",
      unit: "",
      rawValue: (p) => cVal(p, (c) => c.counts.usbC, null),
    },
  },
  {
    key: "jack-35",
    label: "3.5mm jack",
    getValue: (p) => cVal(p, (c) => (c.hasJack35mm ? "Yes" : "—"), "—"),
  },
  {
    key: "price-cny",
    label: "Price (CNY)",
    getValue: (p) => cVal(p, (c) => formatValue(c.priceCny, "¥"), "—"),
    numericFilter: {
      paramKey: "case-max-cny",
      unit: "¥",
      rawValue: (p) => cVal(p, (c) => c.priceCny, null),
    },
  },
  {
    key: "price-usd",
    label: "Price (USD)",
    getValue: (p) => cVal(p, (c) => formatValue(c.priceUsd, "$"), "—"),
    numericFilter: {
      paramKey: "case-max-usd",
      unit: "$",
      rawValue: (p) => cVal(p, (c) => c.priceUsd, null),
    },
  },
  {
    key: "sff-link",
    label: "SFF.Net link",
    getValue: (p) =>
      cVal(p, (c) => (c.sffNetLink ? String(c.sffNetLink) : "—"), "—"),
  },
  {
    key: "last-update",
    label: "Updated",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.lastUpdate), "—"),
  },
];

const GPU_COLUMNS: MetricColumnDef[] = [
  {
    key: "chipset",
    label: "Chipset",
    getValue: (p) => gVal(p, (g) => emptyToDash(g.chipset), "—"),
  },
  {
    key: "length",
    label: "Length",
    getValue: (p) =>
      gVal(p, (g) => formatValue(g.dimensions.lengthMm, "mm"), "—"),
    numericFilter: {
      paramKey: "max-gpu-length-mm",
      unit: "mm",
      rawValue: (p) => gVal(p, (g) => g.dimensions.lengthMm, null),
    },
  },
  {
    key: "width",
    label: "Width",
    getValue: (p) =>
      gVal(p, (g) => formatValue(g.dimensions.widthMm, "mm"), "—"),
    numericFilter: {
      paramKey: "max-gpu-width-mm",
      unit: "mm",
      rawValue: (p) => gVal(p, (g) => g.dimensions.widthMm, null),
    },
  },
  {
    key: "thickness",
    label: "Thickness",
    getValue: (p) =>
      gVal(p, (g) => formatValue(g.dimensions.thicknessMm, "mm"), "—"),
    numericFilter: {
      paramKey: "max-gpu-thickness-mm",
      unit: "mm",
      rawValue: (p) => gVal(p, (g) => g.dimensions.thicknessMm, null),
    },
  },
  {
    key: "slots",
    label: "Slots",
    getValue: (p) => gVal(p, (g) => formatValue(g.dimensions.pcieSlots), "—"),
    numericFilter: {
      paramKey: "max-gpu-slots",
      unit: "slots",
      rawValue: (p) => gVal(p, (g) => g.dimensions.pcieSlots, null),
    },
  },
  {
    key: "boost-clock",
    label: "Boost clock",
    getValue: (p) => gVal(p, (g) => formatValue(g.boostClockMhz, "MHz"), "—"),
    numericFilter: {
      paramKey: "max-gpu-boost-clock-mhz",
      unit: "MHz",
      rawValue: (p) => gVal(p, (g) => g.boostClockMhz, null),
    },
  },
  {
    key: "memory-speed",
    label: "Mem speed",
    getValue: (p) =>
      gVal(p, (g) => formatValue(g.memorySpeedGbps, "Gbps"), "—"),
    numericFilter: {
      paramKey: "max-gpu-memory-speed-gbps",
      unit: "Gbps",
      rawValue: (p) => gVal(p, (g) => g.memorySpeedGbps, null),
    },
  },
  {
    key: "tdp",
    label: "TDP",
    getValue: (p) => gVal(p, (g) => formatValue(g.tdpW, "W"), "—"),
    numericFilter: {
      paramKey: "max-gpu-tdp-w",
      unit: "W",
      rawValue: (p) => gVal(p, (g) => g.tdpW, null),
    },
  },
  {
    key: "pcie-pins",
    label: "PCIe pins",
    getValue: (p) => gVal(p, (g) => emptyToDash(g.pciePins), "—"),
  },
  {
    key: "fan-count",
    label: "Fans",
    getValue: (p) => gVal(p, (g) => formatValue(g.fanCount), "—"),
    numericFilter: {
      paramKey: "max-gpu-fan-count",
      unit: "",
      rawValue: (p) => gVal(p, (g) => g.fanCount, null),
    },
  },
  {
    key: "displayport",
    label: "DP",
    getValue: (p) => gVal(p, (g) => formatValue(g.displayportCount), "—"),
    numericFilter: {
      paramKey: "max-gpu-displayport-count",
      unit: "",
      rawValue: (p) => gVal(p, (g) => g.displayportCount, null),
    },
  },
  {
    key: "hdmi",
    label: "HDMI",
    getValue: (p) => gVal(p, (g) => formatValue(g.hdmiCount), "—"),
    numericFilter: {
      paramKey: "max-gpu-hdmi-count",
      unit: "",
      rawValue: (p) => gVal(p, (g) => g.hdmiCount, null),
    },
  },
  {
    key: "usb-c",
    label: "USB-C",
    getValue: (p) => gVal(p, (g) => formatValue(g.usbCCount), "—"),
    numericFilter: {
      paramKey: "max-gpu-usb-c-count",
      unit: "",
      rawValue: (p) => gVal(p, (g) => g.usbCCount, null),
    },
  },
  {
    key: "low-profile",
    label: "Low profile",
    getValue: (p) => gVal(p, (g) => (g.lowProfile ? "Yes" : "—"), "—"),
  },
  {
    key: "watercooled",
    label: "Watercooled",
    getValue: (p) => gVal(p, (g) => (g.watercooled ? "Yes" : "—"), "—"),
  },
  {
    key: "blower",
    label: "Blower",
    getValue: (p) => gVal(p, (g) => (g.blower ? "Yes" : "—"), "—"),
  },
  {
    key: "dvi",
    label: "DVI-D",
    getValue: (p) => gVal(p, (g) => (g.dviD ? "Yes" : "—"), "—"),
  },
  {
    key: "remarks",
    label: "Remarks",
    getValue: (p) => gVal(p, (g) => emptyToDash(g.remarks), "—"),
  },
];

// Generic part column helpers
function genericDim(part: PartRecord, keys: string[], unit = ""): string {
  return isGenericPart(part) ? dimensionValue(part, keys, unit) : "—";
}
function genericSpec(part: PartRecord, keys: string[]): string {
  return isGenericPart(part) ? specValue(part, keys) : "—";
}
function genericNum(part: PartRecord, keys: string[]): number | null {
  return isGenericPart(part) ? dimensionNumber(part, keys) : null;
}
function genericYesNo(part: PartRecord, keys: string[]): string {
  return isGenericPart(part) ? yesNoValue(part, keys) : "—";
}

const COOLER_COLUMNS: MetricColumnDef[] = [
  { key: "type", label: "Type", getValue: (p) => genericSpec(p, ["type"]) },
  {
    key: "length",
    label: "Length",
    getValue: (p) => genericDim(p, ["length", "length_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-length-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["length", "length_mm"]),
    },
  },
  {
    key: "width",
    label: "Width",
    getValue: (p) => genericDim(p, ["width", "width_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-width-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["width", "width_mm"]),
    },
  },
  {
    key: "height",
    label: "Height",
    getValue: (p) =>
      genericDim(p, ["height", "height_mm", "cooler_height"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-height-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["height", "height_mm", "cooler_height"]),
    },
  },
  {
    key: "footprint",
    label: "Footprint",
    getValue: (p) => (isGenericPart(p) ? footprintValue(p, "mm") : "—"),
  },
  {
    key: "weight",
    label: "Weight",
    getValue: (p) => genericDim(p, ["weight_g", "weight"], "g"),
    numericFilter: {
      paramKey: "cooler-max-weight-g",
      unit: "g",
      rawValue: (p) => genericNum(p, ["weight_g", "weight"]),
    },
  },
  {
    key: "material",
    label: "Material",
    getValue: (p) => genericSpec(p, ["heatsink_material", "material"]),
  },
  {
    key: "heatpipes",
    label: "Heatpipes",
    getValue: (p) => genericDim(p, ["heatpipes"]),
    numericFilter: {
      paramKey: "cooler-max-heatpipes",
      unit: "",
      rawValue: (p) => genericNum(p, ["heatpipes"]),
    },
  },
  {
    key: "block-length",
    label: "Block L",
    getValue: (p) => genericDim(p, ["block_length", "block_length_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-block-length-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["block_length", "block_length_mm"]),
    },
  },
  {
    key: "block-width",
    label: "Block W",
    getValue: (p) => genericDim(p, ["block_width", "block_width_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-block-width-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["block_width", "block_width_mm"]),
    },
  },
  {
    key: "block-height",
    label: "Block H",
    getValue: (p) => genericDim(p, ["block_height", "block_height_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-block-height-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["block_height", "block_height_mm"]),
    },
  },
  {
    key: "pump-speed",
    label: "Pump speed",
    getValue: (p) => genericDim(p, ["pump_speed", "pump_speed_rpm"], "RPM"),
    numericFilter: {
      paramKey: "cooler-max-pump-speed-rpm",
      unit: "RPM",
      rawValue: (p) => genericNum(p, ["pump_speed", "pump_speed_rpm"]),
    },
  },
  {
    key: "pump-location",
    label: "Pump location",
    getValue: (p) => genericSpec(p, ["pump_location"]),
  },
  {
    key: "tube-length",
    label: "Tube length",
    getValue: (p) => genericDim(p, ["tube_length_mm", "tube_length"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-tube-length-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["tube_length_mm", "tube_length"]),
    },
  },
  {
    key: "fan-thickness",
    label: "Fan thickness",
    getValue: (p) => genericDim(p, ["fan_thickness", "fan_thickness_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-fan-thickness-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["fan_thickness", "fan_thickness_mm"]),
    },
  },
  {
    key: "total-thickness",
    label: "Total thickness",
    getValue: (p) =>
      genericDim(p, ["total_thickness", "total_thickness_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-total-thickness-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["total_thickness", "total_thickness_mm"]),
    },
  },
  {
    key: "tdp",
    label: "TDP",
    getValue: (p) => genericDim(p, ["tdp", "tdp_w"], "W"),
    numericFilter: {
      paramKey: "cooler-max-tdp-w",
      unit: "W",
      rawValue: (p) => genericNum(p, ["tdp", "tdp_w"]),
    },
  },
  {
    key: "fan-size",
    label: "Fan size",
    getValue: (p) => genericDim(p, ["fan_size", "fan_size_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-fan-size-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["fan_size", "fan_size_mm"]),
    },
  },
  {
    key: "fan-count",
    label: "Fans",
    getValue: (p) => genericDim(p, ["fan_count"]),
    numericFilter: {
      paramKey: "cooler-max-fan-count",
      unit: "",
      rawValue: (p) => genericNum(p, ["fan_count"]),
    },
  },
  {
    key: "fan-speed",
    label: "Fan speed",
    getValue: (p) => genericDim(p, ["fan_speed", "fan_speed_rpm"], "RPM"),
    numericFilter: {
      paramKey: "cooler-max-fan-speed-rpm",
      unit: "RPM",
      rawValue: (p) => genericNum(p, ["fan_speed", "fan_speed_rpm"]),
    },
  },
  {
    key: "airflow",
    label: "Airflow",
    getValue: (p) => genericDim(p, ["airflow_cfm"], "CFM"),
    numericFilter: {
      paramKey: "cooler-max-airflow-cfm",
      unit: "CFM",
      rawValue: (p) => genericNum(p, ["airflow_cfm"]),
    },
  },
  {
    key: "static-pressure",
    label: "Static press.",
    getValue: (p) =>
      genericDim(p, ["static_pressure", "static_pressure_mmh2o"], "mmH₂O"),
    numericFilter: {
      paramKey: "cooler-max-static-pressure-mmh2o",
      unit: "mmH₂O",
      rawValue: (p) =>
        genericNum(p, ["static_pressure", "static_pressure_mmh2o"]),
    },
  },
  {
    key: "noise",
    label: "Noise",
    getValue: (p) => genericDim(p, ["noise_dba"], "dBA"),
    numericFilter: {
      paramKey: "cooler-max-noise-dba",
      unit: "dBA",
      rawValue: (p) => genericNum(p, ["noise_dba"]),
    },
  },
  {
    key: "rgb-12v",
    label: "RGB 12V",
    getValue: (p) => genericYesNo(p, ["rgb_12v"]),
  },
  {
    key: "argb-5v",
    label: "aRGB 5V",
    getValue: (p) => genericYesNo(p, ["argb_5v"]),
  },
  {
    key: "usb-header",
    label: "USB 2.0 header",
    getValue: (p) => genericYesNo(p, ["usb_2_0_header"]),
  },
  {
    key: "pcie-power",
    label: "PCIe/SATA power",
    getValue: (p) => genericSpec(p, ["pcie_sata_power"]),
  },
  {
    key: "socket-amd-fm",
    label: "Socket AMD FM",
    getValue: (p) => genericYesNo(p, ["socket_amd_fm"]),
  },
  {
    key: "socket-am4",
    label: "Socket AM4/AM5",
    getValue: (p) => genericYesNo(p, ["socket_amd_am4_am5"]),
  },
  {
    key: "socket-775",
    label: "Socket LGA775",
    getValue: (p) => genericYesNo(p, ["socket_intel_775"]),
  },
  {
    key: "socket-115x",
    label: "Socket LGA115x",
    getValue: (p) => genericYesNo(p, ["socket_intel_115x_1200"]),
  },
  {
    key: "socket-1366",
    label: "Socket LGA1366",
    getValue: (p) => genericYesNo(p, ["socket_intel_1366"]),
  },
  {
    key: "socket-1700",
    label: "Socket LGA1700",
    getValue: (p) => genericYesNo(p, ["socket_intel_1700_1851"]),
  },
  {
    key: "socket-2011",
    label: "Socket LGA2011",
    getValue: (p) => genericYesNo(p, ["socket_intel_2011_2066"]),
  },
  {
    key: "ram-clearance",
    label: "RAM clear",
    getValue: (p) => genericDim(p, ["ram_clearance", "ram_clearance_mm"], "mm"),
    numericFilter: {
      paramKey: "cooler-max-ram-clearance-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["ram_clearance", "ram_clearance_mm"]),
    },
  },
  {
    key: "review-by-aris",
    label: "Aris review",
    getValue: (p) => genericSpec(p, ["review_by_aris"]),
  },
  {
    key: "remarks",
    label: "Remarks",
    getValue: (p) => genericSpec(p, ["remarks"]),
  },
];

const PSU_COLUMNS: MetricColumnDef[] = [
  {
    key: "tier",
    label: "Tier",
    getValue: (p) => (isGenericPart(p) ? psuTierLabel(p) || "—" : "—"),
  },
  {
    key: "form-factor",
    label: "Form factor",
    getValue: (p) => genericSpec(p, ["form_factor", "psu"]),
  },
  {
    key: "wattage",
    label: "Wattage",
    getValue: (p) => genericDim(p, ["wattage", "watt", "watts"], "W"),
    numericFilter: {
      paramKey: "psu-max-wattage",
      unit: "W",
      rawValue: (p) => genericNum(p, ["wattage", "watt", "watts"]),
    },
  },
  {
    key: "ac-input",
    label: "AC input",
    getValue: (p) =>
      genericDim(p, ["ac_input_voltage_v", "ac_input_voltage"], "V"),
    numericFilter: {
      paramKey: "psu-max-ac-input-v",
      unit: "V",
      rawValue: (p) =>
        genericNum(p, ["ac_input_voltage_v", "ac_input_voltage"]),
    },
  },
  {
    key: "atx-3",
    label: "ATX 3",
    getValue: (p) => genericYesNo(p, ["atx_3_compatible"]),
  },
  {
    key: "rating",
    label: "80+ rating",
    getValue: (p) => genericSpec(p, ["efficiency_80plus", "80_plus_rating"]),
  },
  {
    key: "efficiency-report",
    label: "80+ report",
    getValue: (p) => genericSpec(p, ["efficiency_80plus_report"]),
  },
  {
    key: "cybenetics-eta-115",
    label: "Cyb η 115V",
    getValue: (p) => genericSpec(p, ["cybenetics_eta_115v"]),
  },
  {
    key: "cybenetics-eta-230",
    label: "Cyb η 230V",
    getValue: (p) => genericSpec(p, ["cybenetics_eta_230v"]),
  },
  {
    key: "cybenetics-lambda-115",
    label: "Cyb λ 115V",
    getValue: (p) => genericSpec(p, ["cybenetics_lambda_115v"]),
  },
  {
    key: "cybenetics-lambda-230",
    label: "Cyb λ 230V",
    getValue: (p) => genericSpec(p, ["cybenetics_lambda_230v"]),
  },
  {
    key: "cybenetics-report",
    label: "Cyb report",
    getValue: (p) => genericSpec(p, ["cybenetics_report_url"]),
  },
  {
    key: "modular",
    label: "Modular",
    getValue: (p) => genericYesNo(p, ["modular"]),
  },
  {
    key: "semi-passive",
    label: "Semi-passive",
    getValue: (p) => genericYesNo(p, ["semi_passive"]),
  },
  {
    key: "fan-start-load",
    label: "Fan start load",
    getValue: (p) => genericSpec(p, ["fan_start_load_pct"]),
  },
  {
    key: "fan-size",
    label: "Fan size",
    getValue: (p) => genericDim(p, ["fan_size", "fan_size_mm"], "mm"),
    numericFilter: {
      paramKey: "psu-max-fan-size-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["fan_size", "fan_size_mm"]),
    },
  },
  {
    key: "atx-bracket",
    label: "ATX bracket",
    getValue: (p) => genericYesNo(p, ["atx_bracket"]),
  },
  {
    key: "cable-24pin",
    label: "24-pin ATX",
    getValue: (p) => genericDim(p, ["cable_24pin_atx_count"]),
    numericFilter: {
      paramKey: "psu-max-cable-24pin",
      unit: "",
      rawValue: (p) => genericNum(p, ["cable_24pin_atx_count"]),
    },
  },
  {
    key: "cable-8pin-eps",
    label: "8-pin EPS",
    getValue: (p) => genericDim(p, ["cable_8pin_eps_count"]),
    numericFilter: {
      paramKey: "psu-max-cable-8pin-eps",
      unit: "",
      rawValue: (p) => genericNum(p, ["cable_8pin_eps_count"]),
    },
  },
  {
    key: "cable-pcie-62",
    label: "PCIe 6+2",
    getValue: (p) => genericDim(p, ["cable_pcie_6_2_count"]),
    numericFilter: {
      paramKey: "psu-max-cable-pcie-62",
      unit: "",
      rawValue: (p) => genericNum(p, ["cable_pcie_6_2_count"]),
    },
  },
  {
    key: "cable-12vhpwr",
    label: "12VHPWR",
    getValue: (p) => genericSpec(p, ["12vhpwr_12v_2x6_connectors"]) || "—",
  },
  {
    key: "cable-sata",
    label: "SATA cables",
    getValue: (p) => genericDim(p, ["cable_sata_count"]),
    numericFilter: {
      paramKey: "psu-max-cable-sata",
      unit: "",
      rawValue: (p) => genericNum(p, ["cable_sata_count"]),
    },
  },
  {
    key: "cable-peripheral",
    label: "Peripheral",
    getValue: (p) => genericDim(p, ["cable_peripheral_count"]),
    numericFilter: {
      paramKey: "psu-max-cable-peripheral",
      unit: "",
      rawValue: (p) => genericNum(p, ["cable_peripheral_count"]),
    },
  },
  {
    key: "warranty",
    label: "Warranty",
    getValue: (p) => genericDim(p, ["warranty_years"], "yr"),
    numericFilter: {
      paramKey: "psu-max-warranty-years",
      unit: "yr",
      rawValue: (p) => genericNum(p, ["warranty_years"]),
    },
  },
  { key: "oem", label: "OEM", getValue: (p) => genericSpec(p, ["oem"]) },
  {
    key: "review-by-aris",
    label: "Aris review",
    getValue: (p) => genericSpec(p, ["review_by_aris"]),
  },
  {
    key: "remarks",
    label: "Remarks",
    getValue: (p) => genericSpec(p, ["remarks"]),
  },
];

const MOTHERBOARD_COLUMNS: MetricColumnDef[] = [
  {
    key: "form-factor",
    label: "Form factor",
    getValue: (p) => (isGenericPart(p) ? motherboardFormFactor(p) : "—"),
  },
  {
    key: "socket",
    label: "Socket",
    getValue: (p) => genericSpec(p, ["socket"]),
  },
  {
    key: "chipset",
    label: "Chipset",
    getValue: (p) => genericSpec(p, ["chipset"]),
  },
  { key: "cpu", label: "CPU", getValue: (p) => genericSpec(p, ["cpu"]) },
  {
    key: "height",
    label: "Height",
    getValue: (p) => genericDim(p, ["height", "height_mm"], "mm"),
    numericFilter: {
      paramKey: "mobo-max-height-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["height", "height_mm"]),
    },
  },
  {
    key: "width",
    label: "Width",
    getValue: (p) => genericDim(p, ["width", "width_mm"], "mm"),
    numericFilter: {
      paramKey: "mobo-max-width-mm",
      unit: "mm",
      rawValue: (p) => genericNum(p, ["width", "width_mm"]),
    },
  },
  {
    key: "pcie-gen",
    label: "PCIe gen",
    getValue: (p) => genericSpec(p, ["pcie_gen"]),
  },
  {
    key: "pci-slots",
    label: "PCI slots",
    getValue: (p) => genericDim(p, ["pci_slot_count"]),
    numericFilter: {
      paramKey: "mobo-max-pci-slots",
      unit: "",
      rawValue: (p) => genericNum(p, ["pci_slot_count"]),
    },
  },
  {
    key: "pcie-x1",
    label: "PCIe x1",
    getValue: (p) => genericDim(p, ["pcie_x1_slot_count"]),
    numericFilter: {
      paramKey: "mobo-max-pcie-x1",
      unit: "",
      rawValue: (p) => genericNum(p, ["pcie_x1_slot_count"]),
    },
  },
  {
    key: "pcie-x4",
    label: "PCIe x4",
    getValue: (p) => genericDim(p, ["pcie_x4_slot_count"]),
    numericFilter: {
      paramKey: "mobo-max-pcie-x4",
      unit: "",
      rawValue: (p) => genericNum(p, ["pcie_x4_slot_count"]),
    },
  },
  {
    key: "pcie-x8",
    label: "PCIe x8",
    getValue: (p) => genericDim(p, ["pcie_x8_slot_count"]),
    numericFilter: {
      paramKey: "mobo-max-pcie-x8",
      unit: "",
      rawValue: (p) => genericNum(p, ["pcie_x8_slot_count"]),
    },
  },
  {
    key: "pcie-x16",
    label: "PCIe x16",
    getValue: (p) => genericDim(p, ["pcie_x16_slot_count", "pcie_x16_slot"]),
    numericFilter: {
      paramKey: "mobo-max-pcie-x16-count",
      unit: "",
      rawValue: (p) => genericNum(p, ["pcie_x16_slot_count"]),
    },
  },
  {
    key: "pcie-x16-position",
    label: "x16 position",
    getValue: (p) => genericSpec(p, ["pcie_x16_slot_position"]),
  },
  {
    key: "pcie-bifurcation",
    label: "Bifurcation",
    getValue: (p) => genericSpec(p, ["pcie_bifurcation"]),
  },
  {
    key: "cpu-overclock",
    label: "CPU OC",
    getValue: (p) => genericYesNo(p, ["cpu_overclock"]),
  },
  {
    key: "ram-overclock",
    label: "RAM OC",
    getValue: (p) => genericYesNo(p, ["ram_overclock"]),
  },
  {
    key: "bios-flashback",
    label: "BIOS flashback",
    getValue: (p) => genericYesNo(p, ["bios_flashback"]),
  },
  {
    key: "reset-cmos",
    label: "Reset CMOS",
    getValue: (p) => genericYesNo(p, ["reset_cmos_button"]),
  },
  {
    key: "ram-type",
    label: "RAM type",
    getValue: (p) => genericSpec(p, ["ram_type"]),
  },
  {
    key: "ram-slots",
    label: "RAM slots",
    getValue: (p) => genericDim(p, ["ram_slots"]),
    numericFilter: {
      paramKey: "mobo-max-ram-slots",
      unit: "",
      rawValue: (p) => genericNum(p, ["ram_slots"]),
    },
  },
  {
    key: "ram-capacity",
    label: "Max RAM",
    getValue: (p) => genericDim(p, ["ram_capacity_max_gb"], "GB"),
    numericFilter: {
      paramKey: "mobo-max-ram-capacity-gb",
      unit: "GB",
      rawValue: (p) => genericNum(p, ["ram_capacity_max_gb"]),
    },
  },
  {
    key: "ram-speed",
    label: "RAM speed",
    getValue: (p) => genericDim(p, ["ram_speed_max_mbps"], "Mbps"),
    numericFilter: {
      paramKey: "mobo-max-ram-speed-mbps",
      unit: "Mbps",
      rawValue: (p) => genericNum(p, ["ram_speed_max_mbps"]),
    },
  },
  {
    key: "m2",
    label: "M.2 slots",
    getValue: (p) => genericDim(p, ["m2_key_m_slot_count"]),
    numericFilter: {
      paramKey: "mobo-max-m2-count",
      unit: "",
      rawValue: (p) => genericNum(p, ["m2_key_m_slot_count"]),
    },
  },
  {
    key: "sata",
    label: "SATA ports",
    getValue: (p) => genericDim(p, ["sata_3_0_port_count"]),
    numericFilter: {
      paramKey: "mobo-max-sata-count",
      unit: "",
      rawValue: (p) => genericNum(p, ["sata_3_0_port_count"]),
    },
  },
  {
    key: "usb-total",
    label: "USB total",
    getValue: (p) => genericDim(p, ["total_usb_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb-ports",
      unit: "",
      rawValue: (p) => genericNum(p, ["total_usb_ports"]),
    },
  },
  {
    key: "usb-a-20",
    label: "USB-A 2.0",
    getValue: (p) => genericDim(p, ["usb_a_2_0_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb-a20",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_a_2_0_ports"]),
    },
  },
  {
    key: "usb-c-20",
    label: "USB-C 2.0",
    getValue: (p) => genericDim(p, ["usb_c_2_0_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb-c20",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_c_2_0_ports"]),
    },
  },
  {
    key: "usb-a-32-gen1",
    label: "USB-A 3.2 G1",
    getValue: (p) => genericDim(p, ["usb_a_3_2_gen1_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb-a32g1",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_a_3_2_gen1_ports"]),
    },
  },
  {
    key: "usb-c-32-gen1",
    label: "USB-C 3.2 G1",
    getValue: (p) => genericDim(p, ["usb_c_3_2_gen1_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb-c32g1",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_c_3_2_gen1_ports"]),
    },
  },
  {
    key: "usb-a-32-gen2",
    label: "USB-A 3.2 G2",
    getValue: (p) => genericDim(p, ["usb_a_3_2_gen2_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb-a32g2",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_a_3_2_gen2_ports"]),
    },
  },
  {
    key: "usb-c-32-gen2",
    label: "USB-C 3.2 G2",
    getValue: (p) => genericDim(p, ["usb_c_3_2_gen2_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb-c32g2",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_c_3_2_gen2_ports"]),
    },
  },
  {
    key: "usb-c-32-gen2x2",
    label: "USB-C 3.2 G2x2",
    getValue: (p) => genericDim(p, ["usb_c_3_2_gen2x2_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb-c32g2x2",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_c_3_2_gen2x2_ports"]),
    },
  },
  {
    key: "usb4",
    label: "USB4",
    getValue: (p) => genericDim(p, ["usb4_ports"]),
    numericFilter: {
      paramKey: "mobo-max-usb4",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb4_ports"]),
    },
  },
  {
    key: "thunderbolt-3",
    label: "TB3",
    getValue: (p) => genericDim(p, ["thunderbolt_3_ports"]),
    numericFilter: {
      paramKey: "mobo-max-tb3",
      unit: "",
      rawValue: (p) => genericNum(p, ["thunderbolt_3_ports"]),
    },
  },
  {
    key: "thunderbolt-4",
    label: "TB4",
    getValue: (p) => genericDim(p, ["thunderbolt_4_ports"]),
    numericFilter: {
      paramKey: "mobo-max-tb4",
      unit: "",
      rawValue: (p) => genericNum(p, ["thunderbolt_4_ports"]),
    },
  },
  {
    key: "usb2-header",
    label: "USB 2.0 hdr",
    getValue: (p) => genericDim(p, ["usb_2_0_header_count"]),
    numericFilter: {
      paramKey: "mobo-max-usb2-header",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_2_0_header_count"]),
    },
  },
  {
    key: "usb32-gen1-header",
    label: "USB 3.2 G1 hdr",
    getValue: (p) => genericDim(p, ["usb_3_2_gen1_header_count"]),
    numericFilter: {
      paramKey: "mobo-max-usb32g1-header",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_3_2_gen1_header_count"]),
    },
  },
  {
    key: "usb-c-header",
    label: "USB-C header",
    getValue: (p) => genericDim(p, ["usb_c_header_count"]),
    numericFilter: {
      paramKey: "mobo-max-usbc-header",
      unit: "",
      rawValue: (p) => genericNum(p, ["usb_c_header_count"]),
    },
  },
  {
    key: "lan-ports",
    label: "LAN ports",
    getValue: (p) => genericDim(p, ["lan_port_count"]),
    numericFilter: {
      paramKey: "mobo-max-lan-ports",
      unit: "",
      rawValue: (p) => genericNum(p, ["lan_port_count"]),
    },
  },
  {
    key: "lan-controller",
    label: "LAN controller",
    getValue: (p) => genericSpec(p, ["lan_controller"]),
  },
  {
    key: "lan-speed",
    label: "LAN speed",
    getValue: (p) => genericDim(p, ["lan_speed_gbps"], "Gbps"),
    numericFilter: {
      paramKey: "mobo-max-lan-speed-gbps",
      unit: "Gbps",
      rawValue: (p) => genericNum(p, ["lan_speed_gbps"]),
    },
  },
  {
    key: "m2-wifi-bt",
    label: "M.2 WiFi/BT",
    getValue: (p) => genericYesNo(p, ["m2_key_e_wifi_bt"]),
  },
  {
    key: "wifi",
    label: "WiFi",
    getValue: (p) => genericSpec(p, ["wifi", "wifi_module"]),
  },
  {
    key: "wifi-speed",
    label: "WiFi speed",
    getValue: (p) => genericDim(p, ["wifi_speed_mbps"], "Mbps"),
    numericFilter: {
      paramKey: "mobo-max-wifi-speed-mbps",
      unit: "Mbps",
      rawValue: (p) => genericNum(p, ["wifi_speed_mbps"]),
    },
  },
  {
    key: "bluetooth",
    label: "Bluetooth",
    getValue: (p) => genericSpec(p, ["bluetooth"]),
  },
  {
    key: "audio",
    label: "Audio",
    getValue: (p) => genericSpec(p, ["audio"]),
  },
  {
    key: "spdif-out",
    label: "SPDIF out",
    getValue: (p) => genericYesNo(p, ["optical_spdif_out"]),
  },
  {
    key: "jack-35",
    label: "3.5mm jacks",
    getValue: (p) => genericDim(p, ["jack_3_5mm_count"]),
    numericFilter: {
      paramKey: "mobo-max-jack-35",
      unit: "",
      rawValue: (p) => genericNum(p, ["jack_3_5mm_count"]),
    },
  },
  {
    key: "displayport",
    label: "DisplayPort",
    getValue: (p) => genericDim(p, ["displayport_count"]),
    numericFilter: {
      paramKey: "mobo-max-dp",
      unit: "",
      rawValue: (p) => genericNum(p, ["displayport_count"]),
    },
  },
  {
    key: "hdmi",
    label: "HDMI",
    getValue: (p) => genericDim(p, ["hdmi_count"]),
    numericFilter: {
      paramKey: "mobo-max-hdmi",
      unit: "",
      rawValue: (p) => genericNum(p, ["hdmi_count"]),
    },
  },
  {
    key: "dvi",
    label: "DVI",
    getValue: (p) => genericDim(p, ["dvi_count"]),
    numericFilter: {
      paramKey: "mobo-max-dvi",
      unit: "",
      rawValue: (p) => genericNum(p, ["dvi_count"]),
    },
  },
  {
    key: "vga",
    label: "VGA",
    getValue: (p) => genericYesNo(p, ["vga"]),
  },
  {
    key: "ps2",
    label: "PS/2",
    getValue: (p) => genericYesNo(p, ["ps2_port"]),
  },
  {
    key: "fan-pump-headers",
    label: "Fan/pump hdrs",
    getValue: (p) => genericDim(p, ["fan_pump_header_count"]),
    numericFilter: {
      paramKey: "mobo-max-fan-pump-headers",
      unit: "",
      rawValue: (p) => genericNum(p, ["fan_pump_header_count"]),
    },
  },
  {
    key: "rgb-header",
    label: "RGB 12V hdr",
    getValue: (p) => genericDim(p, ["rgb_12v_header_count"]),
    numericFilter: {
      paramKey: "mobo-max-rgb-header",
      unit: "",
      rawValue: (p) => genericNum(p, ["rgb_12v_header_count"]),
    },
  },
  {
    key: "argb-header",
    label: "aRGB 5V hdr",
    getValue: (p) => genericDim(p, ["argb_5v_header_count"]),
    numericFilter: {
      paramKey: "mobo-max-argb-header",
      unit: "",
      rawValue: (p) => genericNum(p, ["argb_5v_header_count"]),
    },
  },
  {
    key: "temp-sensor",
    label: "Temp sensor",
    getValue: (p) => genericYesNo(p, ["temp_sensor_header"]),
  },
  {
    key: "debug-led",
    label: "Debug LED",
    getValue: (p) => genericYesNo(p, ["debug_led"]),
  },
  {
    key: "remarks",
    label: "Remarks",
    getValue: (p) => genericSpec(p, ["remarks"]),
  },
];

const RAM_COLUMNS: MetricColumnDef[] = [
  {
    key: "type",
    label: "Type",
    getValue: (p) => genericSpec(p, ["memory_type"]),
  },
  {
    key: "height",
    label: "Height",
    getValue: (p) =>
      genericDim(p, ["height", "height_mm", "height_incl_contact_pins"], "mm"),
    numericFilter: {
      paramKey: "ram-max-height-mm",
      unit: "mm",
      rawValue: (p) =>
        genericNum(p, ["height", "height_mm", "height_incl_contact_pins"]),
    },
  },
  { key: "rgb", label: "RGB", getValue: (p) => genericYesNo(p, ["rgb"]) },
];

const KIND_METRIC_COLUMNS: Record<string, MetricColumnDef[]> = {
  case: CASE_COLUMNS,
  gpu: GPU_COLUMNS,
  "cpu-cooler": COOLER_COLUMNS,
  psu: PSU_COLUMNS,
  motherboard: MOTHERBOARD_COLUMNS,
  ram: RAM_COLUMNS,
};

function metricColumnsFor(kind: SelectableKind): MetricColumnDef[] {
  return KIND_METRIC_COLUMNS[kind] ?? [];
}

// ---------------------------------------------------------------------------

const pageSize = 25;
const psuPageSize = 500;

const FILTER_GROUPS: Record<string, Record<string, string>> = {
  case: {
    "case-max-length-mm": "Dimensions",
    "case-max-width-mm": "Dimensions",
    "case-max-height-mm": "Dimensions",
    "case-max-volume-l": "Dimensions",
    "case-max-footprint-cm2": "Dimensions",
    "case-max-weight-kg": "Dimensions",
    "case-max-gpu-length-mm": "GPU fit",
    "case-max-gpu-width-mm": "GPU fit",
    "case-max-gpu-thickness-mm": "GPU fit",
    "case-max-pcie-slots": "GPU fit",
    "case-max-lp-pcie-slots": "GPU fit",
    "case-max-cpu-cooler-height-mm": "Cooling",
    "case-max-fan-40": "Cooling",
    "case-max-fan-60": "Cooling",
    "case-max-fan-80": "Cooling",
    "case-max-fan-92": "Cooling",
    "case-max-fan-120": "Cooling",
    "case-max-fan-140": "Cooling",
    "case-max-fan-180": "Cooling",
    "case-max-fan-200": "Cooling",
    "case-max-usb-a20": "I/O & Price",
    "case-max-usb-a32": "I/O & Price",
    "case-max-usb-c": "I/O & Price",
    "case-max-cny": "I/O & Price",
    "case-max-usd": "I/O & Price",
  },
  gpu: {
    "max-gpu-length-mm": "Dimensions",
    "max-gpu-width-mm": "Dimensions",
    "max-gpu-thickness-mm": "Dimensions",
    "max-gpu-slots": "Dimensions",
    "max-gpu-boost-clock-mhz": "Power & Clocks",
    "max-gpu-memory-speed-gbps": "Power & Clocks",
    "max-gpu-tdp-w": "Power & Clocks",
    "max-gpu-fan-count": "Outputs & Fans",
    "max-gpu-displayport-count": "Outputs & Fans",
    "max-gpu-hdmi-count": "Outputs & Fans",
    "max-gpu-usb-c-count": "Outputs & Fans",
  },
  "cpu-cooler": {
    "cooler-max-length-mm": "Dimensions",
    "cooler-max-width-mm": "Dimensions",
    "cooler-max-height-mm": "Dimensions",
    "cooler-max-weight-g": "Dimensions",
    "cooler-max-block-length-mm": "Dimensions",
    "cooler-max-block-width-mm": "Dimensions",
    "cooler-max-block-height-mm": "Dimensions",
    "cooler-max-tube-length-mm": "Dimensions",
    "cooler-max-fan-thickness-mm": "Dimensions",
    "cooler-max-total-thickness-mm": "Dimensions",
    "cooler-max-fan-size-mm": "Dimensions",
    "cooler-max-ram-clearance-mm": "Dimensions",
    "cooler-max-heatpipes": "Performance",
    "cooler-max-pump-speed-rpm": "Performance",
    "cooler-max-tdp-w": "Performance",
    "cooler-max-fan-count": "Performance",
    "cooler-max-fan-speed-rpm": "Performance",
    "cooler-max-airflow-cfm": "Performance",
    "cooler-max-static-pressure-mmh2o": "Performance",
    "cooler-max-noise-dba": "Performance",
  },
  psu: {
    "psu-max-wattage": "Power",
    "psu-max-ac-input-v": "Power",
    "psu-max-cable-24pin": "Cables",
    "psu-max-cable-8pin-eps": "Cables",
    "psu-max-cable-pcie-62": "Cables",
    "psu-max-cable-sata": "Cables",
    "psu-max-cable-peripheral": "Cables",
    "psu-max-fan-size-mm": "Physical",
    "psu-max-warranty-years": "Physical",
  },
  motherboard: {
    "mobo-max-height-mm": "Dimensions",
    "mobo-max-width-mm": "Dimensions",
    "mobo-max-pci-slots": "Expansion",
    "mobo-max-pcie-x1": "Expansion",
    "mobo-max-pcie-x4": "Expansion",
    "mobo-max-pcie-x8": "Expansion",
    "mobo-max-pcie-x16-count": "Expansion",
    "mobo-max-ram-slots": "Memory & Storage",
    "mobo-max-ram-capacity-gb": "Memory & Storage",
    "mobo-max-ram-speed-mbps": "Memory & Storage",
    "mobo-max-m2-count": "Memory & Storage",
    "mobo-max-sata-count": "Memory & Storage",
    "mobo-max-usb-ports": "I/O",
    "mobo-max-usb-a20": "I/O",
    "mobo-max-usb-c20": "I/O",
    "mobo-max-usb-a32g1": "I/O",
    "mobo-max-usb-c32g1": "I/O",
    "mobo-max-usb-a32g2": "I/O",
    "mobo-max-usb-c32g2": "I/O",
    "mobo-max-usb-c32g2x2": "I/O",
    "mobo-max-usb4": "I/O",
    "mobo-max-tb3": "I/O",
    "mobo-max-tb4": "I/O",
    "mobo-max-usb2-header": "I/O",
    "mobo-max-usb32g1-header": "I/O",
    "mobo-max-usbc-header": "I/O",
    "mobo-max-lan-ports": "I/O",
    "mobo-max-lan-speed-gbps": "I/O",
    "mobo-max-wifi-speed-mbps": "I/O",
    "mobo-max-jack-35": "I/O",
    "mobo-max-dp": "I/O",
    "mobo-max-hdmi": "I/O",
    "mobo-max-dvi": "I/O",
    "mobo-max-fan-pump-headers": "I/O",
    "mobo-max-rgb-header": "I/O",
    "mobo-max-argb-header": "I/O",
  },
  ram: {
    "ram-max-height-mm": "Dimensions",
  },
};
const psuTierSourceUrl =
  "https://docs.google.com/spreadsheets/d/1akCHL7Vhzk_EhrpIGkz8zTEvYfLDcaSpZRB6Xt6JWkc/edit";
const psuTokenAliases: Record<string, string> = {
  sfx: "sfx",
  sfxl: "sfxl",
  flexatx: "flexatx",
  flex: "flexatx",
  atx: "atx",
  tfx: "tfx",
  dcatx: "dcatx",
  dc: "dcatx",
  external: "external",
  custom: "custom",
  "1u": "1u",
};
const motherboardTokenAliases: Record<string, string> = {
  mitx: "mitx",
  miniitx: "mitx",
  matx: "matx",
  microatx: "matx",
  mdtx: "mdtx",
  minidtx: "mdtx",
  atx: "atx",
  eatx: "eatx",
  mstx: "mstx",
  ministx: "mstx",
  ssiceb: "ssiceb",
  ssieeb: "ssieeb",
  xlatx: "xlatx",
  custom: "custom",
};

export async function getBuildView(
  context: APIContext,
  url: URL,
): Promise<BuildView> {
  const state = parseBuildQuery(url);
  const selectedIds = state.selectedIds;
  const parts = await loadParts(context);
  const selectedIdList = slotOrder
    .map(({ kind }) => selectedIds[kind])
    .filter((id): id is string => Boolean(id));
  const lookup = await loadCatalogPartsByIds(context, selectedIdList);
  const partIndex = new Map<string, PartRecord>();

  parts.cases.forEach((part) => partIndex.set(part.id, part));
  parts.gpus.forEach((part) => partIndex.set(part.id, part));
  lookup.parts.forEach((part) => {
    if (!partIndex.has(part.id)) partIndex.set(part.id, part);
  });

  const activeCase = partByKind(partIndex, selectedIds.case, "case");
  const activeGpu = partByKind(partIndex, selectedIds.gpu, "gpu");
  const activeCpuCooler = partByKind(
    partIndex,
    selectedIds["cpu-cooler"],
    "cpu-cooler",
  );
  const activePsu = partByKind(partIndex, selectedIds.psu, "psu");
  const activeMotherboard = partByKind(
    partIndex,
    selectedIds.motherboard,
    "motherboard",
  );
  const activeRam = partByKind(partIndex, selectedIds.ram, "ram");
  const ctx = {
    state,
    partIndex,
    activeCase,
    activeGpu,
    activeCpuCooler,
    activePsu,
    activeMotherboard,
    activeRam,
  };

  // Auto-populate GPU numeric filter defaults from the active case
  if (state.kind === "gpu" && activeCase) {
    if (
      !("max-gpu-length-mm" in state.numericFilters) &&
      activeCase.dimensions.gpuLengthMm != null
    ) {
      state.numericFilters["max-gpu-length-mm"] =
        activeCase.dimensions.gpuLengthMm;
    }
    if (
      !("max-gpu-slots" in state.numericFilters) &&
      activeCase.dimensions.pcieSlots != null
    ) {
      state.numericFilters["max-gpu-slots"] = activeCase.dimensions.pcieSlots;
    }
    if (
      !("max-gpu-thickness-mm" in state.numericFilters) &&
      activeCase.dimensions.gpuThicknessMm != null
    ) {
      state.numericFilters["max-gpu-thickness-mm"] =
        activeCase.dimensions.gpuThicknessMm;
    }
  }

  const candidates = filterSparseRows(
    (await loadCandidates(context, state, parts)).candidates,
    state,
  );
  const totalRows = candidates.length;
  const builtRows = candidates.map((part) => buildRow(ctx, part));
  const sortedRows =
    state.search.trim() && state.sort === "release-year"
      ? builtRows
      : builtRows.sort((a, b) => rowSort(a, b, state));
  const rows = sortedRows.slice(
    (state.page - 1) * activePageSize(state.kind),
    state.page * activePageSize(state.kind),
  );
  const pageCount = Math.max(
    1,
    Math.ceil(totalRows / activePageSize(state.kind)),
  );
  const displayStart = totalRows
    ? (state.page - 1) * activePageSize(state.kind) + 1
    : 0;
  const displayEnd = Math.min(
    state.page * activePageSize(state.kind),
    totalRows,
  );
  const slots = slotOrder.map((slot) => buildSlot(ctx, slot.kind));
  const selectedFitments = slotOrder
    .map(({ kind }) => {
      const id = selectedIds[kind];
      const part = id ? partIndex.get(id) : null;
      return part
        ? { kind, summary: evaluateCandidateFitment(ctx, part) }
        : null;
    })
    .filter(
      (entry): entry is { kind: SelectableKind; summary: FitmentSummary } =>
        Boolean(entry),
    );
  const buildStatus = getBuildStatus(selectedFitments, activeCase, activeGpu);

  return {
    state,
    slotOrder,
    tabOrder,
    slots,
    buildStatus,
    buildStatusLabel:
      buildStatus === "in-progress" ? "IN PROGRESS" : buildStatus.toUpperCase(),
    buildStatusCopy: buildStatusCopy(buildStatus),
    buildIssues: buildIssues(ctx, selectedFitments),
    activeConstraintLabel: activeConstraintLabel(activeCase, activeGpu),
    constraintMeters: constraintMeters(ctx),
    kindTabs: tabOrder.map((kind) => ({
      kind,
      href: buildUrl(state, { kind, resetPage: true }),
      active: kind === state.kind,
    })),
    searchAction: "/build",
    hiddenInputs: searchHiddenInputs(state),
    numericFilters: numericFilters(state, parts),
    numericFilterGroups: groupNumericFilters(numericFilters(state, parts)),
    clearFiltersUrl: buildUrl(state, {
      numericFilters: {},
      resetPage: true,
    }),
    tableHeaders: tableHeaders(state),
    rows,
    totalRows,
    displayStart,
    displayEnd,
    pageCount,
    previousUrl: buildUrl(state, { page: Math.max(1, state.page - 1) }),
    nextUrl: buildUrl(state, { page: Math.min(pageCount, state.page + 1) }),
    psuTierSourceUrl,
    activeFilterChips: buildFilterChips(state),
    tableNotice: buildTableNotice(ctx, state),
  };
}

async function loadCandidates(
  context: APIContext,
  state: BuildQueryState,
  parts: Awaited<ReturnType<typeof loadParts>>,
): Promise<{ totalRows: number; candidates: PartRecord[] }> {
  const metricDefs = metricColumnsFor(state.kind);
  if (state.kind === "case" || state.kind === "gpu") {
    const pool = state.kind === "case" ? parts.cases : parts.gpus;
    const filtered = state.search.trim()
      ? state.kind === "case"
        ? await searchTypedCandidates(
            context,
            parts.cases,
            state.kind,
            state.search,
          )
        : await searchTypedCandidates(
            context,
            parts.gpus,
            state.kind,
            state.search,
          )
      : pool;
    const narrowed = applyNumericFilters(filtered, state, metricDefs);
    const totalRows = narrowed.length;
    return {
      totalRows,
      candidates: narrowed,
    };
  }

  const catalog = await loadCatalog(context, {
    kind: state.kind,
    page: 1,
    pageSize: 5000,
    search: state.search,
  });

  let candidates: PartRecord[] = catalog.parts.filter(
    (part): part is GenericPart & { kind: SelectableKind } =>
      part.kind === state.kind,
  );
  candidates = applyNumericFilters(candidates, state, metricDefs);

  return {
    totalRows: candidates.length,
    candidates,
  };
}

function filterSparseRows<T extends PartRecord>(
  parts: T[],
  state: BuildQueryState,
) {
  if (state.showSparseRows) return parts;
  const metricDefs = metricColumnsFor(state.kind);
  return parts.filter((part) => hasFitmentRelevantData(part, metricDefs));
}

function hasFitmentRelevantData(
  part: PartRecord,
  metricDefs: MetricColumnDef[],
) {
  // A row has useful data if any displayed metric cell has a non-trivial value
  return metricDefs.some((def) => {
    const value = def.getValue(part);
    return isUsefulCellValue(value);
  });
}

function isUsefulCellValue(value: string) {
  const normalized = value.trim();
  if (!normalized || isBlankSpec(normalized)) return false;
  return normalized !== "—" && normalized !== "— x —";
}

function applyNumericFilters(
  parts: PartRecord[],
  state: BuildQueryState,
  metricDefs: MetricColumnDef[],
) {
  const activeFilters = metricDefs.filter(
    (def) =>
      def.numericFilter &&
      state.numericFilters[def.numericFilter.paramKey] !== undefined,
  );
  if (!activeFilters.length) return parts;
  return parts.filter((part) =>
    activeFilters.every((def) => {
      const max = state.numericFilters[def.numericFilter!.paramKey];
      const value = def.numericFilter!.rawValue(part);
      return value !== null && value !== undefined && value <= max;
    }),
  );
}

async function searchTypedCandidates<T extends CasePart | GpuPart>(
  context: APIContext,
  pool: T[],
  kind: SelectableKind,
  query: string,
) {
  const partsById = new Map(pool.map((part) => [part.id, part]));
  const suggestions = (
    await searchCatalog(context, { query, kind, limit: 1000 })
  ).suggestions;

  return suggestions
    .map((suggestion) => partsById.get(suggestion.id))
    .filter((part): part is T => Boolean(part));
}

function activePageSize(kind: SelectableKind) {
  return kind === "psu" ? psuPageSize : pageSize;
}

function partByKind<K extends PartRecord["kind"]>(
  index: Map<string, PartRecord>,
  id: string | undefined,
  kind: K,
) {
  const part = id ? index.get(id) : null;
  return part?.kind === kind
    ? (part as Extract<PartRecord, { kind: K }>)
    : null;
}

function isCasePart(part: PartRecord): part is CasePart {
  return part.kind === "case" && "seller" in part;
}

function isGpuPart(part: PartRecord): part is GpuPart {
  return part.kind === "gpu" && "chipset" in part;
}

function isGenericPart(part: PartRecord): part is GenericPart {
  return "displayName" in part;
}

function partReleaseYear(part: PartRecord): number | null {
  return part.releaseYear ?? null;
}

type EvalContext = {
  state: BuildQueryState;
  partIndex: Map<string, PartRecord>;
  activeCase: CasePart | null;
  activeGpu: GpuPart | null;
  activeCpuCooler: GenericPart | null;
  activePsu: GenericPart | null;
  activeMotherboard: GenericPart | null;
  activeRam: GenericPart | null;
};

function buildSlot(ctx: EvalContext, kind: SelectableKind): BuildViewSlot {
  const descriptor = slotOrder.find((slot) => slot.kind === kind)!;
  const id = ctx.state.selectedIds[kind] ?? "";
  const part = id ? (ctx.partIndex.get(id) ?? null) : null;
  const verdict = slotVerdict(ctx, kind, part);

  return {
    kind,
    label: descriptor.label,
    actionLabel: descriptor.actionLabel,
    id,
    state: id && !part ? "unresolved" : "resolved",
    title: id ? (part ? displayTitle(part) : "Unresolved selection") : "Empty",
    subtitle: part ? displaySubtitle(part) : id || "",
    note:
      id && !part
        ? "The id is still preserved in URL state, but the catalog can no longer resolve it."
        : slotNote(ctx, kind),
    verdict,
    verdictCopy: verdictCopy(verdict),
    verdictTooltip: verdictTooltip(verdict),
    specs: slotSpecs(ctx, kind, part),
    clearUrl: buildUrl(ctx.state, { clearSlot: kind, resetPage: true }),
    browseUrl: buildUrl(ctx.state, { kind, resetPage: true }),
  };
}

function buildRow(ctx: EvalContext, part: PartRecord): BuildViewRow {
  const kind = part.kind as SelectableKind;
  const selected = ctx.state.selectedIds[kind] === part.id;
  const hasSelection = Boolean(ctx.state.selectedIds[kind]);
  const fitment = evaluateCandidateFitment(ctx, part);
  const note = fitment.messages[0] || fitment.notes[0] || fallbackNote(part);
  const cells = metricCells(part);
  const metricLabels = tableHeaderLabels(ctx.state.kind).slice(2, -2);

  return {
    id: part.id,
    kind,
    title: displayTitle(part),
    subtitle: displaySubtitle(part),
    cells,
    mobileMetrics: metricLabels.map((label, i) => ({
      label,
      value: cells[i] ?? "",
      alert: fitment.highlightCellIndex === i,
    })),
    verdict: fitment.verdict,
    verdictLabel: verdictLabel(fitment.verdict),
    verdictTooltip: verdictTooltip(fitment.verdict),
    note,
    selected,
    actionLabel: selected ? "Remove" : hasSelection ? "Swap" : "Add",
    actionTone: selected ? "remove" : hasSelection ? "swap" : "add",
    actionUrl: selected
      ? buildUrl(ctx.state, { clearSlot: kind, resetPage: true })
      : buildUrl(ctx.state, {
          selectedIds: { [kind]: part.id },
          search: "",
          resetPage: true,
        }),
    highlightCellIndex: fitment.highlightCellIndex,
    releaseYear: partReleaseYear(part),
  };
}

function rowSort(a: BuildViewRow, b: BuildViewRow, state: BuildQueryState) {
  const direction = state.dir === "desc" ? -1 : 1;

  if (state.sort !== "fitment") {
    const delta = compareSortValue(
      sortValue(a, state.sort),
      sortValue(b, state.sort),
    );
    if (delta !== 0) return delta * direction;
  }

  const verdictDelta = verdictRank(a.verdict) - verdictRank(b.verdict);
  if (verdictDelta !== 0) return verdictDelta;
  if (state.kind === "psu") {
    const tierDelta = psuTierRank(a.cells[0]) - psuTierRank(b.cells[0]);
    if (tierDelta !== 0) return tierDelta;
  }
  if (a.selected !== b.selected) return a.selected ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function sortValue(row: BuildViewRow, key: string) {
  if (key === "status") return verdictRank(row.verdict);
  if (key === "name") return row.title;
  if (key === "notes") return row.note;
  if (key === "release-year") return row.releaseYear ?? "";
  const metricMatch = key.match(/^metric-(\d+)$/);
  if (metricMatch) return row.cells[Number(metricMatch[1])] ?? "";
  return row.title;
}

function compareSortValue(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aNumber = numericPrefix(String(a));
  const bNumber = numericPrefix(String(b));
  if (aNumber !== null || bNumber !== null) {
    if (aNumber === null) return 1;
    if (bNumber === null) return -1;
    return aNumber - bNumber;
  }
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function numericPrefix(value: string) {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function psuTierRank(label: string) {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 99;
}

function getBuildStatus(
  selectedFitments: Array<{ kind: SelectableKind; summary: FitmentSummary }>,
  activeCase: CasePart | null,
  activeGpu: GpuPart | null,
): BuildStatus {
  const verdicts = selectedFitments
    .map(({ summary }) => summary.verdict)
    .filter((verdict): verdict is FitVerdict => verdict !== "unscored");
  if (verdicts.includes("fail")) return "fail";
  if (verdicts.includes("conditional")) return "conditional";
  return verdicts.length && activeCase && activeGpu ? "pass" : "in-progress";
}

function buildStatusCopy(status: BuildStatus) {
  if (status === "in-progress") return "";
  if (status === "pass") return "All known dimensions fit.";
  if (status === "conditional")
    return "Build has warnings — tight clearances, missing data, or practical risks.";
  return "Build contains at least one hard dimensional conflict.";
}

function buildIssues(
  ctx: EvalContext,
  selectedFitments: Array<{ kind: SelectableKind; summary: FitmentSummary }>,
) {
  const sections: Array<{
    kind: SelectableKind;
    label: string;
    issues: string[];
  }> = [];

  selectedFitments
    .filter(
      ({ summary }) =>
        summary.verdict !== "pass" &&
        summary.verdict !== "unscored" &&
        summary.messages.length,
    )
    .forEach(({ kind, summary }) => {
      sections.push({
        kind,
        label: slotOrder.find((slot) => slot.kind === kind)!.label,
        issues: summary.messages,
      });
    });

  slotOrder.forEach(({ kind, label }) => {
    const id = ctx.state.selectedIds[kind];
    if (id && !ctx.partIndex.has(id)) {
      sections.push({
        kind,
        label,
        issues: [
          `Selected ${label.toLowerCase()} id "${id}" could not be loaded from the current catalog.`,
        ],
      });
    }
  });

  return sections;
}

function searchHiddenInputs(state: BuildQueryState) {
  const inputs: Array<{ name: string; value: string }> = [
    { name: "kind", value: state.kind },
  ];
  slotOrder.forEach(({ kind }) => {
    const value = state.selectedIds[kind];
    if (value) inputs.push({ name: kind, value });
  });
  if (state.sort !== "release-year")
    inputs.push({ name: "sort", value: state.sort });
  if (state.sort !== "release-year" && state.dir === "desc")
    inputs.push({ name: "dir", value: state.dir });
  if (state.sort === "release-year" && state.dir !== "desc")
    inputs.push({ name: "dir", value: state.dir });
  if (state.showSparseRows) inputs.push({ name: "show-sparse", value: "1" });
  numericFilterInputs(state).forEach((input) => inputs.push(input));
  return inputs;
}

function numericFilterInputs(state: BuildQueryState) {
  const inputs: Array<{ name: string; value: string }> = [];
  for (const [paramName, value] of Object.entries(state.numericFilters)) {
    if (value !== null && value !== undefined) {
      inputs.push({ name: paramName, value: formatQueryNumber(value) });
    }
  }
  return inputs;
}

function numericFilters(
  state: BuildQueryState,
  parts: Awaited<ReturnType<typeof loadParts>>,
): BuildViewNumericFilter[] {
  const metricDefs = metricColumnsFor(state.kind);
  const filterDefs = metricDefs
    .filter((def) => def.numericFilter)
    .map((def) => def.numericFilter!);

  // Collect raw values from all candidate parts
  const allParts: PartRecord[] =
    state.kind === "case"
      ? parts.cases
      : state.kind === "gpu"
        ? parts.gpus
        : [];
  const groups = FILTER_GROUPS[state.kind] ?? {};
  return filterDefs.map((def) => {
    const values = allParts
      .map((p) => def.rawValue(p))
      .filter((v): v is number => v !== null);
    const max = Math.ceil(Math.max(0, ...values, 1));
    return makeNumericFilter(
      def.paramKey,
      def.paramKey
        .replace(/^(case|max|gpu|psu|cooler|mobo|ram)-/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      def.unit,
      max,
      1,
      state.numericFilters[def.paramKey] ?? null,
      groups[def.paramKey] ?? "Specs",
    );
  });
}

function makeNumericFilter(
  name: BuildViewNumericFilter["name"],
  label: string,
  unit: BuildViewNumericFilter["unit"],
  max: number,
  step: number,
  value: number | null,
  group: string,
): BuildViewNumericFilter {
  return {
    name,
    label,
    unit,
    max,
    step,
    value: value ?? max,
    active: value !== null,
    group,
  };
}

function groupNumericFilters(
  filters: BuildViewNumericFilter[],
): BuildViewNumericFilterGroup[] {
  const map = new Map<string, BuildViewNumericFilter[]>();
  for (const filter of filters) {
    const list = map.get(filter.group) ?? [];
    list.push(filter);
    map.set(filter.group, list);
  }
  return Array.from(map.entries()).map(([label, groupFilters]) => {
    const active = groupFilters.filter((f) => f.active);
    const activeCount = active.length;
    let summary: string;
    if (activeCount === 0) {
      summary = "Any";
    } else if (activeCount === 1) {
      const f = active[0];
      summary = `${f.value}${f.unit}`;
    } else {
      summary = `${activeCount} active`;
    }
    return { label, filters: groupFilters, activeCount, summary };
  });
}

function tableHeaders(state: BuildQueryState): BuildViewTableHeader[] {
  const labels = tableHeaderLabels(state.kind);
  return labels.map((label, index) => {
    const key = headerSortKey(index, labels.length);
    const sortable = key !== "notes" && key !== "action";
    const nextDir = state.sort === key && state.dir === "asc" ? "desc" : "asc";
    return {
      key,
      label,
      sortable,
      sortUrl: sortable
        ? buildUrl(state, { sort: key, dir: nextDir, resetPage: true })
        : "",
      sortDir: state.sort === key ? state.dir : null,
    };
  });
}

function tableHeaderLabels(kind: SelectableKind) {
  const metricDefs = metricColumnsFor(kind);
  const identityLabel =
    kind === "case" ? "Case" : kind === "gpu" ? "Model" : "Name";
  return [
    "Status",
    identityLabel,
    ...metricDefs.map((d) => d.label),
    "Notes",
    "Action",
  ];
}

function headerSortKey(index: number, headerCount: number) {
  if (index === 0) return "status";
  if (index === 1) return "name";
  if (index === headerCount - 2) return "notes";
  if (index === headerCount - 1) return "action";
  return `metric-${index - 2}`;
}

function constraintMeters(ctx: EvalContext) {
  if (ctx.state.kind === "gpu" && ctx.activeCase) {
    return [
      {
        label: "Length",
        value: ctx.activeCase.dimensions.gpuLengthMm
          ? `Max ${formatValue(ctx.activeCase.dimensions.gpuLengthMm, "mm")}`
          : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(ctx.activeCase.dimensions.gpuLengthMm, 400),
      },
      {
        label: "Thickness",
        value: ctx.activeCase.dimensions.gpuThicknessMm
          ? `Max ${formatValue(ctx.activeCase.dimensions.gpuThicknessMm, "mm")}`
          : "Unknown",
        tone: "conditional" as const,
        ratio: ratioFromLimit(ctx.activeCase.dimensions.gpuThicknessMm, 90),
      },
      {
        label: "Slots",
        value: ctx.activeCase.dimensions.pcieSlots
          ? `Max ${formatValue(ctx.activeCase.dimensions.pcieSlots)}`
          : "Unknown",
        tone: "neutral" as const,
        ratio: ratioFromLimit(ctx.activeCase.dimensions.pcieSlots, 4),
      },
    ];
  }

  if (ctx.state.kind === "case" && ctx.activeGpu) {
    return [
      {
        label: "GPU length",
        value: ctx.activeGpu.dimensions.lengthMm
          ? `${formatValue(ctx.activeGpu.dimensions.lengthMm, "mm")} required`
          : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(ctx.activeGpu.dimensions.lengthMm, 400),
      },
      {
        label: "GPU thickness",
        value: ctx.activeGpu.dimensions.thicknessMm
          ? `${formatValue(ctx.activeGpu.dimensions.thicknessMm, "mm")} required`
          : "Unknown",
        tone: "conditional" as const,
        ratio: ratioFromLimit(ctx.activeGpu.dimensions.thicknessMm, 90),
      },
      {
        label: "Slots",
        value: ctx.activeGpu.dimensions.pcieSlots
          ? `${formatValue(ctx.activeGpu.dimensions.pcieSlots)} required`
          : "Unknown",
        tone: "neutral" as const,
        ratio: ratioFromLimit(ctx.activeGpu.dimensions.pcieSlots, 4),
      },
    ];
  }

  if (ctx.state.kind === "cpu-cooler" && ctx.activeCase) {
    return [
      {
        label: "Cooler height",
        value: ctx.activeCase.dimensions.cpuCoolerHeightMm
          ? `Max ${formatValue(ctx.activeCase.dimensions.cpuCoolerHeightMm, "mm")}`
          : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(ctx.activeCase.dimensions.cpuCoolerHeightMm, 90),
      },
    ];
  }

  if (ctx.state.kind === "psu" && ctx.activeCase) {
    return [
      {
        label: "PSU envelope",
        value: ctx.activeCase.psu || "Unknown",
        tone: "neutral" as const,
        ratio: 0.44,
      },
    ];
  }

  return [
    {
      label: "No derived constraints",
      value: "Select a case or GPU to shape this table",
      tone: "neutral" as const,
      ratio: 0.28,
    },
  ];
}

function activeConstraintLabel(
  activeCase: CasePart | null,
  activeGpu: GpuPart | null,
) {
  if (activeCase) {
    return `${displayTitle(activeCase)}${activeCase.dimensions.volumeL ? ` (${formatValue(activeCase.dimensions.volumeL, "L")})` : ""}`;
  }
  if (activeGpu) return displayTitle(activeGpu);
  return "No active constraints";
}

function buildFilterChips(
  state: BuildQueryState,
): BuildView["activeFilterChips"] {
  const chips: BuildView["activeFilterChips"] = [];

  chips.push({ label: state.kind, href: buildUrl(state, {}), tone: "neutral" });

  if (state.search.trim()) {
    chips.push({
      label: `"${state.search.trim()}"`,
      href: buildUrl(state, { search: "", resetPage: true }),
      tone: "active",
    });
  }

  if (state.sort !== "release-year") {
    chips.push({
      label: `Sort: ${state.sort}`,
      href: buildUrl(state, {
        sort: "release-year",
        dir: "desc",
        resetPage: true,
      }),
      tone: "active",
    });
  }

  if (state.page > 1) {
    chips.push({
      label: `Page ${state.page}`,
      href: buildUrl(state, { page: 1 }),
      tone: "active",
    });
  }

  if (state.showSparseRows) {
    chips.push({
      label: "Showing sparse rows",
      href: buildUrl(state, { showSparseRows: false, resetPage: true }),
      tone: "active",
    });
  }

  // Numeric filter chips from generic map
  const metricDefs = metricColumnsFor(state.kind);
  for (const def of metricDefs) {
    if (!def.numericFilter) continue;
    const paramKey = def.numericFilter.paramKey;
    const value = state.numericFilters[paramKey];
    if (value === undefined) continue;
    const unit = def.numericFilter.unit;
    const remaining: Record<string, number> = {};
    for (const [k, v] of Object.entries(state.numericFilters)) {
      if (k !== paramKey) remaining[k] = v;
    }
    chips.push({
      label: `Max ${def.label.toLowerCase()}: ${value}${unit}`,
      href: buildUrl(state, { numericFilters: remaining, resetPage: true }),
      tone: "active",
    });
  }

  return chips;
}

function buildTableNotice(_ctx: EvalContext, _state: BuildQueryState): string {
  return "";
}

function slotVerdict(
  ctx: EvalContext,
  kind: SelectableKind,
  part: PartRecord | null = null,
): DisplayVerdict {
  if (part) {
    const summary = evaluateCandidateFitment(ctx, part);
    if (summary.verdict !== "unscored") return summary.verdict;
    const totalSelected = Object.values(ctx.state.selectedIds).filter(
      Boolean,
    ).length;
    if (kind === "case" && totalSelected > 1) return "pass";
  }
  return "unscored";
}

function slotNote(ctx: EvalContext, kind: SelectableKind) {
  const id = ctx.state.selectedIds[kind];
  const part = id ? ctx.partIndex.get(id) : null;
  const summary = part ? evaluateCandidateFitment(ctx, part) : null;
  if (summary?.messages.length && summary.verdict !== "pass")
    return summary.messages[0];
  if (summary?.notes.length) return summary.notes[0];
  if (kind === "psu" && ctx.activeCase?.psu)
    return `Constraint: ${ctx.activeCase.psu}`;
  if (kind === "cpu-cooler" && ctx.activeCase?.dimensions.cpuCoolerHeightMm) {
    return `Constraint: max ${formatValue(ctx.activeCase.dimensions.cpuCoolerHeightMm, "mm")}`;
  }
  return "";
}

function metricCells(part: PartRecord) {
  const defs = metricColumnsFor(part.kind as SelectableKind);
  return defs.map((def) => def.getValue(part));
}

function fallbackNote(part: PartRecord) {
  if (isCasePart(part)) {
    return "";
  }
  if (isGpuPart(part)) {
    return "";
  }
  if (isGenericPart(part) && part.kind === "cpu-cooler") {
    return compactJoin([
      specValue(part, ["type"]),
      `Height ${dimensionValue(part, ["height", "cooler_height"], "mm")}`,
    ]);
  }
  if (isGenericPart(part) && part.kind === "psu") {
    return compactJoin([
      psuTierLabel(part),
      specValue(part, ["form_factor", "psu"]),
      `Wattage ${dimensionValue(part, ["wattage", "watt", "watts"], "W")}`,
    ]);
  }
  if (isGenericPart(part) && part.kind === "motherboard")
    return compactJoin([
      motherboardFormFactor(part),
      specValue(part, ["socket"]),
      specValue(part, ["chipset"]),
    ]);
  if (isGenericPart(part) && part.kind === "ram")
    return compactJoin([
      specValue(part, ["memory_type"]),
      `Height ${dimensionValue(part, ["height_incl_contact_pins", "height"], "mm")}`,
    ]);
  return "Catalog-backed selection for this slot.";
}

function evaluateCandidateFitment(
  ctx: EvalContext,
  part: PartRecord,
): FitmentSummary {
  const checks: FitmentCheck[] = [];
  if (isCasePart(part)) {
    if (ctx.activeGpu)
      checks.push(...evaluateGpuAgainstCase(ctx.activeGpu, part));
    if (ctx.activeCpuCooler)
      checks.push(evaluateCpuCoolerAgainstCase(ctx.activeCpuCooler, part));
    if (ctx.activePsu) checks.push(evaluatePsuAgainstCase(ctx.activePsu, part));
    if (ctx.activeMotherboard)
      checks.push(evaluateMotherboardAgainstCase(ctx.activeMotherboard, part));
  } else if (isGpuPart(part)) {
    if (ctx.activeCase)
      checks.push(...evaluateGpuAgainstCase(part, ctx.activeCase));
  } else if (isGenericPart(part) && part.kind === "cpu-cooler") {
    if (ctx.activeCase)
      checks.push(evaluateCpuCoolerAgainstCase(part, ctx.activeCase));
    if (ctx.activeRam)
      checks.push(evaluateRamAgainstCpuCooler(ctx.activeRam, part));
  } else if (isGenericPart(part) && part.kind === "psu") {
    if (ctx.activeCase)
      checks.push(evaluatePsuAgainstCase(part, ctx.activeCase));
  } else if (isGenericPart(part) && part.kind === "motherboard") {
    if (ctx.activeCase)
      checks.push(evaluateMotherboardAgainstCase(part, ctx.activeCase));
    if (ctx.activeRam)
      checks.push(evaluateRamAgainstMotherboard(ctx.activeRam, part));
  } else if (isGenericPart(part) && part.kind === "ram") {
    if (ctx.activeMotherboard)
      checks.push(evaluateRamAgainstMotherboard(part, ctx.activeMotherboard));
    if (ctx.activeCpuCooler)
      checks.push(evaluateRamAgainstCpuCooler(part, ctx.activeCpuCooler));
  }
  return summarizeFitmentChecks(checks);
}

function summarizeFitmentChecks(checks: FitmentCheck[]): FitmentSummary {
  const messages = checks
    .filter(
      (check) => check.message && check.verdict !== "pass" && !check.advisory,
    )
    .map((check) => check.message);
  const notes = checks
    .filter((check) => check.advisory && check.message)
    .map((check) => check.message);
  const firstHighlight =
    checks.find(
      (check) =>
        check.verdict !== "pass" &&
        !check.advisory &&
        check.cellIndex !== undefined,
    )?.cellIndex ?? null;
  if (!checks.length)
    return {
      verdict: "unscored",
      messages: [],
      notes: [],
      highlightCellIndex: null,
    };
  if (checks.some((check) => check.verdict === "fail" && !check.advisory))
    return {
      verdict: "fail",
      messages,
      notes,
      highlightCellIndex: firstHighlight,
    };
  if (
    checks.some((check) => check.verdict === "conditional" && !check.advisory)
  )
    return {
      verdict: "conditional",
      messages,
      notes,
      highlightCellIndex: firstHighlight,
    };
  return { verdict: "pass", messages: [], notes, highlightCellIndex: null };
}

function evaluateGpuAgainstCase(
  gpu: GpuPart,
  casePart: CasePart,
): FitmentCheck[] {
  const result = checkCaseGpuCompatibility(casePart, gpu);
  if (!result.issues.length)
    return [
      { verdict: "pass", message: "GPU dimensions fit the case GPU envelope." },
    ];
  const advisoryGpuIssueCodes = new Set([
    "case-status",
    "tight-gpuLengthMm",
    "tight-gpuWidthMm",
    "tight-gpuThicknessMm",
  ]);
  return result.issues.map((issue) => ({
    verdict:
      issue.severity === "error"
        ? "fail"
        : advisoryGpuIssueCodes.has(issue.code)
          ? "pass"
          : "conditional",
    message: issue.message,
    cellIndex: gpuIssueCellIndex(issue.code),
    advisory: advisoryGpuIssueCodes.has(issue.code),
  }));
}

const coolerHeightCellIndex = COOLER_COLUMNS.findIndex(
  (c) => c.key === "height",
);

function evaluateCpuCoolerAgainstCase(
  cooler: GenericPart,
  casePart: CasePart,
): FitmentCheck {
  const maxHeight = casePart.dimensions.cpuCoolerHeightMm;
  const coolerHeight = dimensionNumber(cooler, [
    "height",
    "height_mm",
    "cooler_height",
  ]);
  if (!maxHeight)
    return {
      verdict: "conditional",
      message: "Case CPU cooler height limit is unknown.",
    };
  if (coolerHeight === null)
    return {
      verdict: "conditional",
      message: `Cooler height is unknown; case max is ${formatValue(maxHeight, "mm")}.`,
      cellIndex: coolerHeightCellIndex >= 0 ? coolerHeightCellIndex : undefined,
    };
  if (coolerHeight > maxHeight)
    return {
      verdict: "fail",
      message: `Cooler height ${formatValue(coolerHeight, "mm")} exceeds case max ${formatValue(maxHeight, "mm")}.`,
      cellIndex: coolerHeightCellIndex >= 0 ? coolerHeightCellIndex : undefined,
    };
  return {
    verdict: "pass",
    message: `Cooler height ${formatValue(coolerHeight, "mm")} fits case max ${formatValue(maxHeight, "mm")}.`,
  };
}

function evaluatePsuAgainstCase(
  psu: GenericPart,
  casePart: CasePart,
): FitmentCheck {
  const caseSupport = casePart.psu;
  const psuFormFactor = specValue(psu, ["form_factor", "psu"]);
  const caseTokens = parseSupportTokens(caseSupport, psuTokenAliases);
  const psuToken = canonicalToken(psuFormFactor, psuTokenAliases);
  if (!caseTokens.size || !psuToken)
    return {
      verdict: "conditional",
      message: `PSU form factor cannot be fully checked; case support is "${caseSupport || "unknown"}" and PSU form factor is "${psuFormFactor || "unknown"}".`,
      cellIndex: 0,
    };
  if (psuToken === "custom" || caseTokens.has("custom"))
    return {
      verdict: "conditional",
      message: `Custom PSU support requires manual verification (${psuFormFactor} in ${caseSupport}).`,
      cellIndex: 0,
    };
  if (caseTokens.has(psuToken))
    return {
      verdict: "pass",
      message: `PSU form factor ${psuFormFactor} is supported by case envelope ${caseSupport}.`,
    };
  return {
    verdict: "fail",
    message: `PSU form factor ${psuFormFactor} is not supported by case envelope ${caseSupport}.`,
    cellIndex: 0,
  };
}

function evaluateMotherboardAgainstCase(
  motherboard: GenericPart,
  casePart: CasePart,
): FitmentCheck {
  const caseSupport =
    casePart.raw.Motherboard || casePart.raw.motherboard || "";
  const boardFormFactor = motherboardFormFactor(motherboard);
  const caseTokens = parseSupportTokens(caseSupport, motherboardTokenAliases);
  const boardToken = canonicalToken(boardFormFactor, motherboardTokenAliases);
  if (!caseTokens.size || !boardToken)
    return {
      verdict: "conditional",
      message: `Motherboard form factor cannot be fully checked; case support is "${caseSupport || "unknown"}" and board form factor is "${boardFormFactor || "unknown"}".`,
      cellIndex: 0,
    };
  if (caseTokens.has("custom") || boardToken === "custom")
    return {
      verdict: "conditional",
      message: `Custom motherboard support requires manual verification (${boardFormFactor} in ${caseSupport}).`,
      cellIndex: 0,
    };
  if (caseTokens.has(boardToken))
    return {
      verdict: "pass",
      message: `Motherboard form factor ${boardFormFactor} is supported by case envelope ${caseSupport}.`,
    };
  return {
    verdict: "fail",
    message: `Motherboard form factor ${boardFormFactor} is not supported by case envelope ${caseSupport}.`,
    cellIndex: 0,
  };
}

function evaluateRamAgainstMotherboard(
  ram: GenericPart,
  motherboard: GenericPart,
): FitmentCheck {
  const ramType = specValue(ram, ["memory_type"]);
  const motherboardRamType = specValue(motherboard, ["ram_type"]);
  if (!ramType || !motherboardRamType)
    return {
      verdict: "conditional",
      message: `RAM type cannot be fully checked; RAM is "${ramType || "unknown"}" and motherboard requires "${motherboardRamType || "unknown"}".`,
      cellIndex: 1,
    };
  if (normalizeSpecToken(ramType) === normalizeSpecToken(motherboardRamType))
    return {
      verdict: "pass",
      message: `${ramType} RAM matches motherboard memory type ${motherboardRamType}.`,
    };
  return {
    verdict: "fail",
    message: `${ramType} RAM does not match motherboard memory type ${motherboardRamType}.`,
    cellIndex: 1,
  };
}

function evaluateRamAgainstCpuCooler(
  ram: GenericPart,
  cooler: GenericPart,
): FitmentCheck {
  const ramHeight = dimensionNumber(ram, [
    "height_incl_contact_pins",
    "height",
  ]);
  const clearanceText = specValue(cooler, ["ram_clearance"]);
  const clearance = dimensionOrSpecNumber(cooler, ["ram_clearance"]);
  if (/no\s*limit/i.test(clearanceText))
    return {
      verdict: "pass",
      message: "CPU cooler lists no RAM height limit.",
    };
  if (ramHeight === null || clearance === null)
    return {
      verdict: "conditional",
      message: `RAM clearance cannot be fully checked; RAM height is ${formatValue(ramHeight, "mm")} and cooler clearance is ${clearanceText || "unknown"}.`,
      cellIndex: 0,
    };
  if (ramHeight > clearance)
    return {
      verdict: "fail",
      message: `RAM height ${formatValue(ramHeight, "mm")} exceeds CPU cooler RAM clearance ${formatValue(clearance, "mm")}.`,
      cellIndex: 0,
    };
  return {
    verdict: "pass",
    message: `RAM height ${formatValue(ramHeight, "mm")} fits CPU cooler RAM clearance ${formatValue(clearance, "mm")}.`,
  };
}

function displayTitle(part: PartRecord | null) {
  if (!part) return "Missing catalog record";
  if (isCasePart(part)) return `${part.seller} ${part.name}`.trim();
  if (isGpuPart(part)) {
    const gpuTokens = [part.model, part.name]
      .map((value) => value.trim())
      .filter((value) => value && value.toLowerCase() !== "gpu");
    return (
      gpuTokens
        .filter((value, index) => gpuTokens.indexOf(value) === index)
        .join(" ")
        .trim() ||
      part.chipset ||
      part.id
    );
  }
  return (
    part.displayName ||
    [part.brand, part.name].filter(Boolean).join(" ").trim() ||
    part.id
  );
}

function displaySubtitle(part: PartRecord | null) {
  if (!part) return "";
  if (isCasePart(part))
    return part.dimensions.volumeL
      ? `${formatValue(part.dimensions.volumeL, "L")} volume`
      : part.style || part.sourceSheet;
  if (isGpuPart(part))
    return (
      part.brand ||
      (part.tdpW
        ? `${formatValue(part.tdpW, "W")} TDP`
        : `${part.sourceSheet} #${part.rowNumber}`)
    );
  if (isGenericPart(part) && part.kind === "cpu-cooler")
    return [specValue(part, ["type"]), "CPU cooler"]
      .filter(Boolean)
      .join(" / ");
  if (isGenericPart(part) && part.kind === "psu")
    return (
      [
        specValue(part, ["form_factor"]),
        psuTierLabel(part),
        specValue(part, ["80_plus_rating"]),
      ]
        .filter(Boolean)
        .join(" / ") || "Power supply"
    );
  if (isGenericPart(part) && part.kind === "motherboard")
    return [motherboardFormFactor(part), specValue(part, ["socket", "chipset"])]
      .filter(Boolean)
      .join(" / ");
  if (isGenericPart(part) && part.kind === "ram")
    return specValue(part, ["memory_type"]) || "Memory";
  return part.kind;
}

function slotSpecs(
  ctx: EvalContext,
  kind: SelectableKind,
  part: PartRecord | null,
): SlotSpec[] {
  if (part && isCasePart(part)) {
    return [
      { label: "Volume", value: formatValue(part.dimensions.volumeL, "L") },
      {
        label: "GPU max L",
        value: formatValue(part.dimensions.gpuLengthMm, "mm"),
      },
      {
        label: "GPU max T",
        value: formatValue(part.dimensions.gpuThicknessMm, "mm"),
      },
      { label: "Slots", value: formatValue(part.dimensions.pcieSlots) },
      {
        label: "CPU cooler",
        value: formatValue(part.dimensions.cpuCoolerHeightMm, "mm"),
      },
      { label: "PSU", value: part.psu || "-" },
      { label: "Riser", value: part.gpuRiser || "-" },
    ];
  }
  if (part && isGpuPart(part)) {
    return [
      { label: "Length", value: formatValue(part.dimensions.lengthMm, "mm") },
      { label: "Width", value: formatValue(part.dimensions.widthMm, "mm") },
      {
        label: "Thickness",
        value: formatValue(part.dimensions.thicknessMm, "mm"),
      },
      { label: "Slots", value: formatValue(part.dimensions.pcieSlots) },
      { label: "Power", value: part.pciePins || "-" },
      { label: "TDP", value: formatValue(part.tdpW, "W") },
      { label: "Low profile", value: part.lowProfile ? "Yes" : "No" },
    ];
  }
  if (part && isGenericPart(part) && part.kind === "cpu-cooler")
    return compactSpecs([
      ["Height", dimensionValue(part, ["height", "cooler_height"], "mm")],
      ["Footprint", footprintValue(part, "mm")],
      ["TDP", dimensionValue(part, ["tdp"], "W")],
      ["RAM clear", dimensionOrSpecValue(part, ["ram_clearance"], "mm")],
      ["Fan", specValue(part, ["fan_size"])],
      ["Type", specValue(part, ["type"])],
    ]);
  if (part && isGenericPart(part) && part.kind === "psu")
    return compactSpecs([
      ["Tier", psuTierLabel(part) || "-"],
      ["Form factor", specValue(part, ["form_factor", "psu"])],
      ["Wattage", dimensionValue(part, ["wattage", "watt", "watts"], "W")],
      ["Modular", yesNoValue(part, ["modular"])],
      ["12VHPWR", specValue(part, ["12vhpwr_12v_2x6_connectors"])],
      ["Rating", specValue(part, ["80_plus_rating"])],
    ]);
  if (part && isGenericPart(part) && part.kind === "motherboard")
    return compactSpecs([
      ["Form factor", motherboardFormFactor(part)],
      ["Socket", specValue(part, ["socket"])],
      ["Chipset", specValue(part, ["chipset"])],
      ["RAM slots", dimensionValue(part, ["ram_slots"])],
      ["RAM type", specValue(part, ["ram_type"])],
      ["PCIe x16", specValue(part, ["pcie_x16_slot"])],
    ]);
  if (part && isGenericPart(part) && part.kind === "ram")
    return compactSpecs([
      [
        "Height",
        dimensionValue(part, ["height_incl_contact_pins", "height"], "mm"),
      ],
      ["Type", specValue(part, ["memory_type"])],
      ["RGB", yesNoValue(part, ["rgb"])],
    ]);
  if (kind === "gpu" && ctx.activeCase)
    return [
      {
        label: "Max length",
        value: formatValue(ctx.activeCase.dimensions.gpuLengthMm, "mm"),
      },
      {
        label: "Max thickness",
        value: formatValue(ctx.activeCase.dimensions.gpuThicknessMm, "mm"),
      },
      {
        label: "Max slots",
        value: formatValue(ctx.activeCase.dimensions.pcieSlots),
      },
      {
        label: "Low profile",
        value: formatValue(ctx.activeCase.dimensions.lpPcieSlots),
      },
    ];
  if (kind === "psu" && ctx.activeCase)
    return [{ label: "Allowed PSU", value: ctx.activeCase.psu || "-" }];
  if (kind === "cpu-cooler" && ctx.activeCase)
    return [
      {
        label: "Max height",
        value: formatValue(ctx.activeCase.dimensions.cpuCoolerHeightMm, "mm"),
      },
    ];
  return [];
}

function verdictRank(verdict: DisplayVerdict) {
  if (verdict === "pass") return 0;
  if (verdict === "conditional") return 1;
  if (verdict === "fail") return 2;
  return 3;
}

function verdictLabel(verdict: DisplayVerdict) {
  return verdict === "unscored" ? "CLEAR" : verdict.toUpperCase();
}

function verdictCopy(verdict: DisplayVerdict) {
  if (verdict === "pass") return "Known fit";
  if (verdict === "conditional") return "Caution";
  if (verdict === "fail") return "Conflict";
  return "No conflicts found";
}

function verdictTooltip(verdict: DisplayVerdict) {
  if (verdict === "pass") return "Dimensions fit within known tolerances.";
  if (verdict === "conditional")
    return "This part may fit, but the data is incomplete. Check the notes for specific warnings about missing dimensions, tight clearances, or practical build risks.";
  if (verdict === "fail") return "Physical dimensions conflict.";
  return "No dimensional conflicts found.";
}

function compactSpecs(entries: Array<[string, string]>): SlotSpec[] {
  return entries
    .map(([label, value]) => ({ label, value: emptyToDash(value) }))
    .filter((spec) => spec.value !== "—");
}

function compactJoin(values: string[]) {
  return (
    values.filter((value) => value && value !== "—").join(" / ") ||
    "Catalog-backed selection for this slot."
  );
}

function specValue(part: GenericPart, keys: string[]) {
  for (const key of keys) {
    const value = rawSpecValue(part.specs[key]) || rawSpecValue(part.raw[key]);
    if (value && !isBlankSpec(value)) return value;
  }
  return "";
}

function rawSpecValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Y" : "";
  return "";
}

function psuTierLabel(part: GenericPart) {
  const tier = specValue(part, ["psu_tier"]);
  return tier ? `Tier ${tier}` : "";
}

function dimensionValue(part: GenericPart, keys: string[], unit = "") {
  for (const key of keys) {
    const value = part.dimensions[key];
    if (value !== undefined) return formatValue(value, unit);
  }
  return "—";
}

function dimensionNumber(part: GenericPart, keys: string[]) {
  for (const key of keys) {
    const value = part.dimensions[key];
    if (value !== undefined) return value;
  }
  return null;
}

function dimensionOrSpecValue(part: GenericPart, keys: string[], unit = "") {
  const dimension = dimensionValue(part, keys, unit);
  return dimension !== "—" ? dimension : specValue(part, keys) || "—";
}

function dimensionOrSpecNumber(part: GenericPart, keys: string[]) {
  const dimension = dimensionNumber(part, keys);
  if (dimension !== null) return dimension;
  for (const key of keys) {
    const match = specValue(part, [key]).match(/-?\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
}

function footprintValue(part: GenericPart, unit = "") {
  const length = dimensionValue(part, ["length"], unit);
  const width = dimensionValue(part, ["width"], unit);
  if (length === "—" && width === "—") return "—";
  return `${length} x ${width}`;
}

function yesNoValue(part: GenericPart, keys: string[]) {
  for (const key of keys) {
    const rawValue =
      rawSpecValue(part.specs[key]) || rawSpecValue(part.raw[key]);
    const value = rawValue.toLowerCase();
    if (!value || isBlankSpec(value)) continue;
    if (["y", "yes", "true", "1"].includes(value)) return "Yes";
    if (["n", "no", "false", "0"].includes(value)) return "—";
    return rawValue;
  }
  return "—";
}

function parseSupportTokens(value: string, aliases: Record<string, string>) {
  const tokens = new Set<string>();
  value
    .replace(/\([^)]*\)/g, "")
    .split(/[\/,+]/)
    .map((token) => canonicalToken(token, aliases))
    .filter(Boolean)
    .forEach((token) => tokens.add(token));
  return tokens;
}

function canonicalToken(value: string, aliases: Record<string, string>) {
  return aliases[normalizeSpecToken(value)] ?? "";
}

function normalizeSpecToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function gpuIssueCellIndex(code: string) {
  // GPU metric columns: chipset(0), length(1), width(2), thickness(3), slots(4), ...
  if (code.includes("gpuLengthMm")) return 1;
  if (code.includes("gpuWidthMm")) return 2;
  if (code.includes("gpuThicknessMm")) return 3;
  if (code.includes("pcieSlots")) return 4;
  return undefined;
}

function formatQueryNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function motherboardFormFactor(part: GenericPart) {
  const explicit = specValue(part, ["form_factor"]);
  if (explicit) return explicit;
  const source = part.sourceSheet.toLowerCase();
  if (source.includes("mitx")) return "mITX";
  if (source.includes("matx")) return "mATX";
  return "—";
}

function emptyToDash(value: string) {
  return value && !isBlankSpec(value) ? value : "—";
}

function isBlankSpec(value: string) {
  return ["", "-", "?", "n/a", "na", "tbd"].includes(
    value.trim().toLowerCase(),
  );
}

function formatValue(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined) return "—";
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
  return `${formatted}${unit}`;
}

function ratioFromLimit(value: number | null | undefined, ceiling: number) {
  if (!value) return 0.34;
  return Math.max(0.12, Math.min(0.94, value / ceiling));
}
