import {
  buildSearchParams,
  buildUrl,
  parseBuildQuery,
  slotOrder,
  tabOrder,
  type BuildQueryState,
  type CaseIntent,
  type CaseVolumeTier,
  type PsuFeatureFilter,
  type PsuFormFactorFilter,
  type PsuTierFilter,
  type SelectableKind,
} from "./build-state";
import type { CasePart, FitVerdict, GenericPart, GpuPart } from "../types";
import type { CatalogStore } from "./catalog-store";
import {
  evaluateCandidateFitment as engineEvaluateCandidateFitment,
  summarizeEvidence,
  type BuildContext,
} from "../fitment/engine";
import { issueTitle } from "../fitment/issue-copy";
import type { FitmentEvidence } from "../fitment/types";
import {
  dimensionNumber,
  dimensionOrSpecNumber,
  dimensionOrSpecValue,
  dimensionValue,
  footprintValue,
  formatValue,
  isBlankSpec,
  motherboardFormFactor,
  parseSupportTokens,
  psuTierRank,
  specValue,
  yesNoValue,
} from "./generic-part";

type PartRecord = GenericPart | CasePart | GpuPart;
type DisplayVerdict = FitVerdict | "unscored";
type BuildStatus = FitVerdict | "in-progress";

export interface BuildViewCell {
  value: string;
  evidenceVerdict: "conditional" | "fail" | null;
  evidenceMessages: string[];
}

type FitmentSummary = {
  verdict: DisplayVerdict;
  messages: string[];
  notes: string[];
  /** Evidence items that may map to table cells (those with a metric key). */
  cellEvidence: FitmentEvidence[];
  /** Every non-pass evidence item, including ignored ones, for issue rendering. */
  issues: BuildViewIssue[];
};
type SlotSpec = {
  label: string;
  value: string;
};

export interface BuildViewIssue {
  code: string;
  /** Short heading from the warning copy map. */
  title: string;
  /** Detailed sentence produced by the fitment engine. */
  message: string;
  verdict: "conditional" | "fail";
  /** Hard conflicts are known physical constraints and cannot be ignored. */
  dismissible: boolean;
  /** True when the user has ignored this evidence code. */
  ignored: boolean;
}

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
  /** Every non-pass finding on this part, ignored ones included. */
  issues: BuildViewIssue[];
  specs: SlotSpec[];
  clearUrl: string;
  browseUrl: string;
}

export interface BuildViewRow {
  id: string;
  kind: SelectableKind;
  title: string;
  subtitle: string;
  cells: BuildViewCell[];
  verdict: DisplayVerdict;
  verdictLabel: string;
  verdictTooltip: string;
  note: string;
  selected: boolean;
  actionLabel: string;
  actionTone: "add" | "remove" | "swap";
  actionUrl: string;
  releaseYear: number | null;
  availabilityRank: number;
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
  derived: boolean;
  group: string;
}

export interface BuildViewNumericFilterGroup {
  label: string;
  filters: BuildViewNumericFilter[];
  options: BuildViewFilterOption[];
  activeCount: number;
  summary: string;
}

export interface BuildViewFilterOption {
  label: string;
  href: string;
  active: boolean;
  tooltip?: string;
}

export interface BuildView {
  state: BuildQueryState;
  slotOrder: typeof slotOrder;
  tabOrder: typeof tabOrder;
  slots: BuildViewSlot[];
  buildStatus: BuildStatus;
  buildStatusLabel: string;
  buildStatusCopy: string;
  /** Plain-text build summary for the clipboard, in the shape of a share list. */
  partListText: string;
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
  /** Engine metric keys that map to this column for cell-level evidence highlighting. */
  evidenceMetrics?: string[];
}

function cVal<R>(part: PartRecord, fn: (c: CasePart) => R, fallback: R): R {
  return isCasePart(part) ? fn(part) : fallback;
}

function caseFootprintCm2(c: CasePart): number | null {
  if (c.dimensions.footprintCm2 !== null) return c.dimensions.footprintCm2;
  const { lengthMm, widthMm } = c.dimensions;
  if (lengthMm === null || widthMm === null) return null;
  return (lengthMm * widthMm) / 100;
}

function gVal<R>(part: PartRecord, fn: (g: GpuPart) => R, fallback: R): R {
  return isGpuPart(part) ? fn(part) : fallback;
}

const CASE_COLUMNS: MetricColumnDef[] = [
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
    key: "footprint",
    label: "Footprint",
    getValue: (p) =>
      cVal(p, (c) => formatValue(caseFootprintCm2(c), "cm²"), "—"),
    numericFilter: {
      paramKey: "case-max-footprint-cm2",
      unit: "cm²",
      rawValue: (p) => cVal(p, caseFootprintCm2, null),
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
    evidenceMetrics: ["coolerHeight"],
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
    evidenceMetrics: ["gpuLengthMm"],
  },
  {
    key: "gpu-width",
    label: "GPU max W",
    getValue: (p) =>
      cVal(p, (c) => formatValue(c.dimensions.gpuWidthMm, "mm"), "—"),
    evidenceMetrics: ["gpuWidthMm"],
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
    evidenceMetrics: ["gpuThicknessMm"],
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
    evidenceMetrics: ["pcieSlots"],
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
    evidenceMetrics: ["motherboardFormFactor"],
  },
  {
    key: "psu",
    label: "PSU",
    getValue: (p) => cVal(p, (c) => emptyToDash(c.psu), "—"),
    evidenceMetrics: ["psuFormFactor"],
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
    evidenceMetrics: ["gpuLengthMm"],
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
    evidenceMetrics: ["gpuWidthMm"],
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
    evidenceMetrics: ["gpuThicknessMm"],
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
    evidenceMetrics: ["pcieSlots"],
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
    evidenceMetrics: ["pcieSlots"],
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
    evidenceMetrics: ["coolerHeight"],
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
    evidenceMetrics: ["ramHeight"],
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
    label: "Rating",
    getValue: (p) => (isGenericPart(p) ? psuTierBadge(p) || "—" : "—"),
  },
  {
    key: "form-factor",
    label: "Form factor",
    getValue: (p) => genericSpec(p, ["form_factor", "psu"]),
    evidenceMetrics: ["psuFormFactor"],
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
    evidenceMetrics: ["motherboardFormFactor"],
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
    evidenceMetrics: ["ramType"],
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
    evidenceMetrics: ["ramType"],
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
    evidenceMetrics: ["ramHeight"],
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


const CASE_VOLUME_TIERS: Array<{ value: CaseVolumeTier; label: string }> = [
  { value: "sub-10l", label: "<10L" },
  { value: "10l-20l", label: "10L-20L" },
  { value: "over-20l", label: ">20L" },
];

const STEAM_MACHINE_CASE_INTENT = {
  minVolumeL: 3,
  maxVolumeL: 6,
  maxDimensionMm: 220,
  maxAspectRatio: 1.45,
} as const;

const CASE_INTENT_OPTIONS: Array<{ value: CaseIntent; label: string; tooltip: string }> = [
  {
    value: "steam-machine",
    label: "Steam Machine-like",
    tooltip: "Near-cube cases close to Valve's current Steam Machine, roughly 3-6 L.",
  },
];

import { FILTER_GROUPS } from "./build-filter-params";

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
const PSU_TIER_FILTERS: Array<{
  value: PsuTierFilter;
  label: string;
  maxRank: number;
}> = [
  { value: "a-or-better", label: "Tier A or better", maxRank: 0.2 },
  { value: "b-or-better", label: "Tier B or better", maxRank: 1.2 },
  { value: "c-or-better", label: "Tier C or better", maxRank: 2.2 },
];
const PSU_FORM_FACTOR_FILTERS: Array<{
  value: PsuFormFactorFilter;
  label: string;
}> = [
  { value: "sfx", label: "SFX" },
  { value: "sfx-l", label: "SFX-L" },
  { value: "flex-atx", label: "Flex ATX" },
  { value: "atx", label: "ATX" },
  { value: "tfx", label: "TFX" },
  { value: "1u", label: "1U" },
];
const PSU_FEATURE_FILTERS: Array<{
  value: PsuFeatureFilter;
  label: string;
  tooltip?: string;
}> = [
  { value: "atx-3", label: "ATX 3.x", tooltip: "Native ATX 3 / PCIe 5 era PSU flag." },
  { value: "12vhpwr", label: "12VHPWR", tooltip: "Has a native 12VHPWR or 12V-2x6 GPU power cable." },
  { value: "fully-modular", label: "Fully modular" },
  { value: "semi-passive", label: "Semi-passive" },
];
const PSU_FILTER_GROUP_ORDER = [
  "Quality",
  "Fitment",
  "Power",
  "Features",
  "Cables",
  "Physical",
];

export interface BuildViewOptions {
  /** Evidence codes the user has ignored, persisted per browser. */
  ignored?: ReadonlySet<string>;
  /** Canonical site origin for copied build links; falls back to the request URL. */
  siteOrigin?: string;
}

export async function getBuildView(
  url: URL,
  store: CatalogStore,
  options: BuildViewOptions = {},
): Promise<BuildView> {
  const storeInstance = store;
  const state = parseBuildQuery(url);
  const selectedIds = state.selectedIds;
  const parts = await storeInstance.loadParts();
  const selectedIdList = slotOrder
    .map(({ kind }) => selectedIds[kind])
    .filter((id): id is string => Boolean(id));
  const lookupParts = await storeInstance.loadPartsByIds(selectedIdList);
  const partIndex = new Map<string, PartRecord>();

  parts.cases.forEach((part) => partIndex.set(part.id, part));
  parts.gpus.forEach((part) => partIndex.set(part.id, part));
  lookupParts.forEach((part) => {
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
    ignored: options.ignored ?? new Set<string>(),
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
    (await loadCandidates(storeInstance, state, parts)).candidates,
    state,
  );
  const numericFilterSource =
    state.kind === "case"
      ? parts.cases
      : state.kind === "gpu"
        ? parts.gpus
        : candidates;
  const viewNumericFilters = numericFilters(state, numericFilterSource);
  const totalRows = candidates.length;
  const builtRows = candidates.map((part) => buildRow(ctx, part));
  const rows =
    state.search.trim() && state.sort === "release-year"
      ? builtRows
      : builtRows.sort((a, b) => rowSort(a, b, state));
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
    partListText: buildPartListText(
      url,
      slots,
      partIndex,
      options.siteOrigin,
    ),
    activeConstraintLabel: activeConstraintLabel(activeCase, activeGpu),
    constraintMeters: constraintMeters(ctx),
    kindTabs: tabOrder.map((kind) => ({
      kind,
      href: buildUrl(state, { kind }),
      active: kind === state.kind,
    })),
    searchAction: "/build",
    hiddenInputs: searchHiddenInputs(state),
    numericFilters: viewNumericFilters,
    numericFilterGroups: groupNumericFilters(state, viewNumericFilters, parts.gpus),
    clearFiltersUrl: buildUrl(state, {
      numericFilters: {},
      caseVolumeTier: null,
      caseIntent: null,
      psuTier: null,
      psuFormFactor: null,
      psuFeatures: [],
      gpuBrand: null,
    }),
    tableHeaders: tableHeaders(state),
    rows,
    totalRows,
    activeFilterChips: buildFilterChips(state),
    tableNotice: buildTableNotice(ctx, state),
  };
}

async function loadCandidates(
  store: CatalogStore,
  state: BuildQueryState,
  parts: { cases: CasePart[]; gpus: GpuPart[] },
): Promise<{ totalRows: number; candidates: PartRecord[] }> {
  const metricDefs = metricColumnsFor(state.kind);
  if (state.kind === "case" || state.kind === "gpu") {
    const pool = state.kind === "case" ? parts.cases : parts.gpus;
    const filtered = state.search.trim()
      ? state.kind === "case"
        ? await searchTypedCandidates(
            store,
            parts.cases,
            state.kind,
            state.search,
          )
        : await searchTypedCandidates(
            store,
            parts.gpus,
            state.kind,
            state.search,
          )
      : pool;
    const narrowed = applyCaseIntentFilter(
      applyCaseVolumeTierFilter(
        applyGpuBrandFilter(applyNumericFilters(filtered, state, metricDefs), state),
        state,
      ),
      state,
    );
    const totalRows = narrowed.length;
    return {
      totalRows,
      candidates: narrowed,
    };
  }

  const kindParts = await store.loadKindCatalog(state.kind, state.search);

  let candidates: PartRecord[] = kindParts.filter(
    (part): part is GenericPart & { kind: SelectableKind } =>
      part.kind === state.kind,
  );
  candidates = applyNumericFilters(candidates, state, metricDefs);
  candidates = applyPsuOptionFilters(candidates, state);

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
  return parts.filter((part) => hasFitmentRelevantData(part, metricDefs, state.kind));
}

const SPARSE_REQUIREMENTS: Partial<Record<SelectableKind, string[]>> = {
  gpu: ["length", "width", "thickness"],
  psu: ["form-factor"],
  "cpu-cooler": ["height"],
  motherboard: ["form-factor"],
  ram: ["height"],
};

function hasFitmentRelevantData(
  part: PartRecord,
  metricDefs: MetricColumnDef[],
  kind?: SelectableKind,
) {
  if (kind === "gpu") {
    const values = new Map(metricDefs.map((def) => [def.key, def.getValue(part)]));
    return (
      isUsefulCellValue(values.get("length") ?? "") &&
      (isUsefulCellValue(values.get("width") ?? "") ||
        isUsefulCellValue(values.get("thickness") ?? ""))
    );
  }
  const requiredKeys = kind ? SPARSE_REQUIREMENTS[kind] : undefined;
  if (requiredKeys) {
    return requiredKeys.some((key) => {
      const metric = metricDefs.find((def) => def.key === key);
      return metric ? isUsefulCellValue(metric.getValue(part)) : false;
    });
  }

  // Cases and other kinds use any displayed fitment-relevant cell.
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

function applyGpuBrandFilter(parts: PartRecord[], state: BuildQueryState) {
  if (state.kind !== "gpu" || !state.gpuBrand) return parts;
  const brand = state.gpuBrand.trim().toLocaleLowerCase();
  return parts.filter(
    (part) => isGpuPart(part) && part.brand.trim().toLocaleLowerCase() === brand,
  );
}

function applyPsuOptionFilters(parts: PartRecord[], state: BuildQueryState) {
  if (state.kind !== "psu") return parts;
  if (!state.psuTier && !state.psuFormFactor && state.psuFeatures.length === 0) {
    return parts;
  }
  return parts.filter((part) => {
    if (!isGenericPart(part) || part.kind !== "psu") return false;
    if (state.psuTier && !matchesPsuTierFilter(part, state.psuTier)) return false;
    if (state.psuFormFactor && !matchesPsuFormFactorFilter(part, state.psuFormFactor)) return false;
    return state.psuFeatures.every((feature) => matchesPsuFeatureFilter(part, feature));
  });
}

function applyCaseVolumeTierFilter(parts: PartRecord[], state: BuildQueryState) {
  if (state.kind !== "case" || !state.caseVolumeTier) return parts;
  return parts.filter((part) => {
    if (!isCasePart(part) || part.dimensions.volumeL === null) return false;
    const volume = part.dimensions.volumeL;
    if (state.caseVolumeTier === "sub-10l") return volume < 10;
    if (state.caseVolumeTier === "10l-20l") return volume >= 10 && volume < 20;
    return volume >= 20;
  });
}

function applyCaseIntentFilter(parts: PartRecord[], state: BuildQueryState) {
  if (state.kind !== "case" || !state.caseIntent) return parts;
  if (state.caseIntent !== "steam-machine") return parts;
  return parts.filter((part) => {
    if (!isCasePart(part)) return false;
    const { volumeL, lengthMm, widthMm, heightMm } = part.dimensions;
    // Must have known volume and all three dimensions
    if (volumeL === null || lengthMm === null || widthMm === null || heightMm === null) return false;
    if (
      volumeL < STEAM_MACHINE_CASE_INTENT.minVolumeL ||
      volumeL > STEAM_MACHINE_CASE_INTENT.maxVolumeL
    ) return false;
    // Near-cube: largest dimension / smallest dimension <= 1.45
    const sorted = [lengthMm, widthMm, heightMm].sort((a, b) => a - b);
    const ratio = sorted[2] / sorted[0];
    if (ratio > STEAM_MACHINE_CASE_INTENT.maxAspectRatio) return false;
    if (sorted[2] > STEAM_MACHINE_CASE_INTENT.maxDimensionMm) return false;
    return true;
  });
}

async function searchTypedCandidates<T extends CasePart | GpuPart>(
  store: CatalogStore,
  pool: T[],
  kind: SelectableKind,
  query: string,
) {
  const partsById = new Map(pool.map((part) => [part.id, part]));
  const suggestions = await store.searchSuggestions(query, kind, 1000);

  return suggestions
    .map((suggestion) => partsById.get(suggestion.id))
    .filter((part): part is T => Boolean(part));
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
  ignored: ReadonlySet<string>;
};

function buildSlot(ctx: EvalContext, kind: SelectableKind): BuildViewSlot {
  const descriptor = slotOrder.find((slot) => slot.kind === kind)!;
  const id = ctx.state.selectedIds[kind] ?? "";
  const part = id ? (ctx.partIndex.get(id) ?? null) : null;
  const summary = part
    ? evaluateCandidateFitment(ctx, part, { findingsFor: kind })
    : null;
  const verdict = slotVerdict(ctx, kind, part, summary);

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
        : slotNote(summary),
    verdict,
    verdictCopy: verdictCopy(verdict),
    verdictTooltip: verdictTooltip(verdict),
    // Active findings stay above the ones the user has already set aside.
    // Array#sort is stable, so engine order holds within each group.
    issues: [...(summary?.issues ?? [])].sort(
      (a, b) => Number(a.ignored) - Number(b.ignored),
    ),
    specs: slotSpecs(ctx, kind, part),
    clearUrl: buildUrl(ctx.state, { clearSlot: kind }),
    browseUrl: buildUrl(ctx.state, { kind }),
  };
}

function buildViewCells(
  part: PartRecord,
  cellEvidence: FitmentEvidence[],
): BuildViewCell[] {
  const defs = metricColumnsFor(part.kind as SelectableKind);
  return defs.map((def) => {
    const value = def.getValue(part);

    // Find evidence items whose metric matches this column
    const matchingEvidence = def.evidenceMetrics
      ? cellEvidence.filter((e) => def.evidenceMetrics!.includes(e.metric!))
      : [];

    // Determine worst verdict across matching evidence
    let evidenceVerdict: "conditional" | "fail" | null = null;
    const evidenceMessages: string[] = [];
    for (const e of matchingEvidence) {
      if (e.verdict === "fail") {
        evidenceVerdict = "fail";
        evidenceMessages.push(e.message);
      } else if (e.verdict === "conditional" && evidenceVerdict !== "fail") {
        evidenceVerdict = "conditional";
        evidenceMessages.push(e.message);
      }
    }

    return { value, evidenceVerdict, evidenceMessages };
  });
}

function buildRow(ctx: EvalContext, part: PartRecord): BuildViewRow {
  const kind = part.kind as SelectableKind;
  const selected = ctx.state.selectedIds[kind] === part.id;
  const hasSelection = Boolean(ctx.state.selectedIds[kind]);
  const fitment = evaluateCandidateFitment(ctx, part, {
    omitRiserAdvisory: true,
  });
  const note = fitment.messages[0] || fitment.notes[0] || fallbackNote(part);
  const cells = buildViewCells(part, fitment.cellEvidence);
  const metricLabels = tableHeaderLabels(ctx.state.kind).slice(1, -2);

  return {
    id: part.id,
    kind,
    title: displayTitle(part),
    subtitle: displaySubtitle(part),
    cells,
    mobileMetrics: metricLabels.map((label, i) => ({
      label,
      value: cells[i]?.value ?? "",
      alert: cells[i]?.evidenceVerdict !== null,
    })),
    verdict: fitment.verdict,
    verdictLabel: verdictLabel(fitment.verdict),
    verdictTooltip: verdictTooltip(fitment.verdict),
    note,
    selected,
    actionLabel: selected ? "Remove" : hasSelection ? "Swap" : "Add",
    actionTone: selected ? "remove" : hasSelection ? "swap" : "add",
    actionUrl: selected
      ? buildUrl(ctx.state, { clearSlot: kind })
      : buildUrl(ctx.state, {
          kind: nextTabKind(ctx.state.kind),
          selectedIds: { [kind]: part.id },
        }),
    releaseYear: partReleaseYear(part),
    availabilityRank: part.availabilityStatus === "unavailable" ? 1 : 0,
  };
}

function rowSort(a: BuildViewRow, b: BuildViewRow, state: BuildQueryState) {
  const direction = state.dir === "desc" ? -1 : 1;

  const availabilityDelta = a.availabilityRank - b.availabilityRank;
  if (availabilityDelta !== 0) return availabilityDelta;

  if (state.sort !== "fitment") {
    const delta = compareSortValue(
      sortValue(a, state.sort, state),
      sortValue(b, state.sort, state),
    );
    if (delta !== 0) return delta * direction;
  }

  const verdictDelta = verdictRank(a.verdict) - verdictRank(b.verdict);
  if (verdictDelta !== 0) return verdictDelta;
  if (state.kind === "psu") {
    const tierDelta = psuTierRank(a.cells[0].value) - psuTierRank(b.cells[0].value);
    if (tierDelta !== 0) return tierDelta;
  }
  if (a.selected !== b.selected) return a.selected ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function sortValue(row: BuildViewRow, key: string, state: BuildQueryState) {
  if (key === "status") return verdictRank(row.verdict);
  if (key === "name") return row.title;
  if (key === "notes") return row.note;
  if (key === "release-year") return row.releaseYear ?? "";
  const metricMatch = key.match(/^metric-(\d+)$/);
  if (metricMatch) {
    const metricIndex = Number(metricMatch[1]);
    const value = row.cells[metricIndex]?.value ?? "";
    if (state.kind === "psu" && metricIndex === 0) {
      // Rating is quality-ranked, not alphabetic. Lower tier rank is better,
      // so negate it so the UI's descending sort puts best PSUs first.
      return -psuTierRank(value);
    }
    return value;
  }
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

/**
 * Plain-text build summary for the clipboard, following the familiar share-list
 * shape: a title line carrying the build URL, one line per selected slot in
 * fixed slot order, and a provenance line. Slots without a resolved part are
 * left out — the URL still carries their ids.
 */
function buildPartListText(
  url: URL,
  slots: BuildViewSlot[],
  partIndex: Map<string, PartRecord>,
  siteOrigin: string | undefined,
): string {
  const lines = [
    `SFF Builder Part List: ${shareableBuildUrl(url, siteOrigin).href}`,
    "",
  ];
  slots.forEach((slot) => {
    if (!slot.id || slot.state === "unresolved") return;
    lines.push(`${slot.label}: ${partListName(slot, partIndex.get(slot.id))}`);
  });
  lines.push("", "Generated by SFF Builder");
  return lines.join("\n");
}

/**
 * The build URL to share: the canonical origin with the path and query being
 * browsed, so a list copied from a local or preview origin still points at the
 * live site. A misconfigured origin falls back to the browsed URL rather than
 * failing the whole view.
 */
function shareableBuildUrl(url: URL, siteOrigin: string | undefined): URL {
  if (!siteOrigin) return url;
  try {
    return new URL(`${url.pathname}${url.search}`, siteOrigin);
  } catch {
    return url;
  }
}

/**
 * A share list needs enough identity to find the part: the brand when the
 * display title omits it (GPU titles are model plus name), and the case title
 * as-is, since it already leads with the seller builders know the case by.
 */
function partListName(slot: BuildViewSlot, part: PartRecord | undefined): string {
  if (!part || isCasePart(part)) return slot.title;
  const brand = part.brand.trim();
  if (!brand || slot.title.toLowerCase().includes(brand.toLowerCase())) {
    return slot.title;
  }
  return `${brand} ${slot.title}`;
}

/**
 * Hidden inputs for the search form, derived from the canonical
 * buildSearchParams helper (same params that buildUrl emits).
 * Excludes "search", which comes from the visible input.
 */
function searchHiddenInputs(state: BuildQueryState) {
  const params = buildSearchParams(state);
  params.delete("search");
  const inputs: Array<{ name: string; value: string }> = [];
  params.forEach((value, name) => inputs.push({ name, value }));
  return inputs;
}

function numericFilters(
  state: BuildQueryState,
  parts: PartRecord[],
): BuildViewNumericFilter[] {
  const metricDefs = metricColumnsFor(state.kind);
  const filterDefs = metricDefs
    .filter((def) => def.numericFilter)
    .map((def) => def.numericFilter!);

  const groups = FILTER_GROUPS[state.kind] ?? {};
  return filterDefs.flatMap((def) => {
    const values = parts
      .map((p) => def.rawValue(p))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (!values.length) return [];
    const max = Math.ceil(Math.max(...values));
    if (max <= 0) return [];
    return [makeNumericFilter(
      def.paramKey,
      def.paramKey
        .replace(/^(case|max|gpu|psu|cooler|mobo|ram)-/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      def.unit,
      max,
      1,
      state.numericFilters[def.paramKey] ?? derivedNumericFilterValue(state, def.paramKey),
      state.numericFilters[def.paramKey] === undefined && derivedNumericFilterValue(state, def.paramKey) !== null,
      groups[def.paramKey] ?? "Specs",
    )];
  });
}

function derivedNumericFilterValue(
  state: BuildQueryState,
  paramKey: string,
): number | null {
  if (state.kind !== "case" || state.caseIntent !== "steam-machine") return null;
  if (paramKey === "case-max-volume-l") return STEAM_MACHINE_CASE_INTENT.maxVolumeL;
  if (
    paramKey === "case-max-length-mm" ||
    paramKey === "case-max-width-mm" ||
    paramKey === "case-max-height-mm"
  ) return STEAM_MACHINE_CASE_INTENT.maxDimensionMm;
  return null;
}

function makeNumericFilter(
  name: BuildViewNumericFilter["name"],
  label: string,
  unit: BuildViewNumericFilter["unit"],
  max: number,
  step: number,
  value: number | null,
  derived: boolean,
  group: string,
): BuildViewNumericFilter {
  return {
    name,
    label,
    unit,
    max,
    step,
    value: value ?? max,
    active: value !== null && !derived,
    derived,
    group,
  };
}

function groupNumericFilters(
  state: BuildQueryState,
  filters: BuildViewNumericFilter[],
  gpuParts: GpuPart[],
): BuildViewNumericFilterGroup[] {
  const map = new Map<string, BuildViewNumericFilter[]>();
  if (state.kind === "gpu") map.set("Brand", []);
  if (state.kind === "psu") {
    for (const group of PSU_FILTER_GROUP_ORDER) map.set(group, []);
  }
  for (const filter of filters) {
    const list = map.get(filter.group) ?? [];
    list.push(filter);
    map.set(filter.group, list);
  }
  return Array.from(map.entries()).flatMap(([label, groupFilters]) => {
    const options = filterOptionsForGroup(state, label, gpuParts);
    if (groupFilters.length === 0 && options.length === 0) return [];
    const active = groupFilters.filter((f) => f.active);
    const activeOptions = options.filter((option) => option.active);
    const activeCount = active.length + activeOptions.length;
    let summary: string;
    if (activeCount === 0) {
      summary = "Any";
    } else if (activeOptions.length === 1 && active.length === 0) {
      summary = activeOptions[0].label;
    } else if (activeCount === 1) {
      const f = active[0];
      summary = `${f.value}${f.unit}`;
    } else {
      summary = `${activeCount} active`;
    }
    return [{ label, filters: groupFilters, options, activeCount, summary }];
  });
}

function filterOptionsForGroup(
  state: BuildQueryState,
  group: string,
  gpuParts: GpuPart[],
): BuildViewFilterOption[] {
  if (state.kind === "gpu" && group === "Brand") {
    const brands = [...new Map(
      gpuParts
        .map((part) => part.brand.trim())
        .filter(Boolean)
        .map((brand) => [brand.toLocaleLowerCase(), brand] as const),
    ).values()].sort((a, b) => a.localeCompare(b));
    return brands.map((brand) => ({
      label: brand,
      href: buildUrl(state, {
        gpuBrand: state.gpuBrand === brand ? null : brand,
      }),
      active: state.gpuBrand?.toLocaleLowerCase() === brand.toLocaleLowerCase(),
    }));
  }
  if (state.kind === "psu") return psuFilterOptionsForGroup(state, group);
  if (state.kind !== "case" || group !== "Dimensions") return [];
  const options: BuildViewFilterOption[] = CASE_VOLUME_TIERS.map((tier) => ({
    label: tier.label,
    href: buildUrl(state, {
      caseVolumeTier: state.caseVolumeTier === tier.value ? null : tier.value,
    }),
    active: state.caseVolumeTier === tier.value,
  }));
  for (const intent of CASE_INTENT_OPTIONS) {
    options.push({
      label: intent.label,
      href: buildUrl(state, {
        caseIntent: state.caseIntent === intent.value ? null : intent.value,
      }),
      active: state.caseIntent === intent.value,
      tooltip: intent.tooltip,
    });
  }
  return options;
}

function psuFilterOptionsForGroup(
  state: BuildQueryState,
  group: string,
): BuildViewFilterOption[] {
  if (group === "Quality") {
    return PSU_TIER_FILTERS.map((option) => ({
      label: option.label,
      href: buildUrl(state, {
        psuTier: state.psuTier === option.value ? null : option.value,
      }),
      active: state.psuTier === option.value,
    }));
  }
  if (group === "Fitment") {
    return PSU_FORM_FACTOR_FILTERS.map((option) => ({
      label: option.label,
      href: buildUrl(state, {
        psuFormFactor: state.psuFormFactor === option.value ? null : option.value,
      }),
      active: state.psuFormFactor === option.value,
    }));
  }
  if (group === "Features") {
    return PSU_FEATURE_FILTERS.map((option) => {
      const active = state.psuFeatures.includes(option.value);
      return {
        label: option.label,
        href: buildUrl(state, {
          psuFeatures: active
            ? state.psuFeatures.filter((feature) => feature !== option.value)
            : [...state.psuFeatures, option.value],
        }),
        active,
        tooltip: option.tooltip,
      };
    });
  }
  return [];
}

function nextTabKind(kind: SelectableKind): SelectableKind {
  const index = tabOrder.indexOf(kind);
  return tabOrder[(index + 1) % tabOrder.length];
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
        ? buildUrl(state, { sort: key, dir: nextDir })
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
    identityLabel,
    ...metricDefs.map((d) => d.label),
    "Notes",
    "Action",
  ];
}

function headerSortKey(index: number, headerCount: number) {
  if (index === 0) return "name";
  if (index === headerCount - 2) return "notes";
  if (index === headerCount - 1) return "action";
  return `metric-${index - 1}`;
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
      href: buildUrl(state, { search: "" }),
      tone: "active",
    });
  }

  if (state.sort !== "release-year") {
    chips.push({
      label: `Sort: ${state.sort}`,
      href: buildUrl(state, {
        sort: "release-year",
        dir: "desc",
      }),
      tone: "active",
    });
  }

  if (state.showSparseRows) {
    chips.push({
      label: "Showing sparse rows",
      href: buildUrl(state, { showSparseRows: false }),
      tone: "active",
    });
  }

  if (state.kind === "case" && state.caseVolumeTier) {
    const tier = CASE_VOLUME_TIERS.find(
      (candidate) => candidate.value === state.caseVolumeTier,
    );
    chips.push({
      label: `Volume: ${tier?.label ?? state.caseVolumeTier}`,
      href: buildUrl(state, { caseVolumeTier: null }),
      tone: "active",
    });
  }

  if (state.kind === "case" && state.caseIntent) {
    const intent = CASE_INTENT_OPTIONS.find(
      (candidate) => candidate.value === state.caseIntent,
    );
    chips.push({
      label: intent?.label ?? state.caseIntent,
      href: buildUrl(state, { caseIntent: null }),
      tone: "active",
    });
  }

  if (state.kind === "gpu" && state.gpuBrand) {
    chips.push({
      label: `Brand: ${state.gpuBrand}`,
      href: buildUrl(state, { gpuBrand: null }),
      tone: "active",
    });
  }

  if (state.kind === "psu" && state.psuTier) {
    const option = PSU_TIER_FILTERS.find((candidate) => candidate.value === state.psuTier);
    chips.push({
      label: option?.label ?? state.psuTier,
      href: buildUrl(state, { psuTier: null }),
      tone: "active",
    });
  }

  if (state.kind === "psu" && state.psuFormFactor) {
    const option = PSU_FORM_FACTOR_FILTERS.find(
      (candidate) => candidate.value === state.psuFormFactor,
    );
    chips.push({
      label: `Form: ${option?.label ?? state.psuFormFactor}`,
      href: buildUrl(state, { psuFormFactor: null }),
      tone: "active",
    });
  }

  if (state.kind === "psu") {
    for (const feature of state.psuFeatures) {
      const option = PSU_FEATURE_FILTERS.find((candidate) => candidate.value === feature);
      chips.push({
        label: option?.label ?? feature,
        href: buildUrl(state, {
          psuFeatures: state.psuFeatures.filter((candidate) => candidate !== feature),
        }),
        tone: "active",
      });
    }
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
      href: buildUrl(state, { numericFilters: remaining }),
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
  part: PartRecord | null,
  summary: FitmentSummary | null,
): DisplayVerdict {
  if (!part || !summary) return "unscored";
  if (summary.verdict !== "unscored") return summary.verdict;
  const totalSelected = Object.values(ctx.state.selectedIds).filter(
    Boolean,
  ).length;
  if (kind === "case" && totalSelected > 1) return "pass";
  return "unscored";
}

/**
 * The card's advisory line. Findings that need action are listed separately as
 * issues, so this only carries advisories that accompany a `pass` — a tight
 * clearance, for example. The case's own envelope (PSU support, cooler height)
 * is part of the case card's specs; repeating it here as a "constraint" read as
 * a warning against a part that already satisfied it.
 */
function slotNote(summary: FitmentSummary | null) {
  return summary?.notes[0] ?? "";
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
      psuTierBadge(part),
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
  options: { omitRiserAdvisory?: boolean; findingsFor?: SelectableKind } = {},
): FitmentSummary {
  const build = buildContext(ctx);
  const decision = engineEvaluateCandidateFitment(build, part);
  const evidence = options.omitRiserAdvisory && part.kind === "gpu"
    ? decision.evidence.filter((e) => e.code !== "requires-riser")
    : decision.evidence;
  return summarizeDecision(evidence, ctx.ignored, options.findingsFor ?? null);
}

function buildContext(ctx: EvalContext): BuildContext {
  return {
    activeCase: ctx.activeCase,
    activeGpu: ctx.activeGpu,
    activeCpuCooler: ctx.activeCpuCooler,
    activePsu: ctx.activePsu,
    activeMotherboard: ctx.activeMotherboard,
    activeRam: ctx.activeRam,
  };
}

/**
 * Reduce engine evidence to a renderable summary.
 *
 * Ignored codes are removed before the verdict is computed, so an ignored
 * warning can bring a part back to `pass`. The verdict always covers every
 * finding for the evaluated part, while the listed findings can be narrowed to
 * the ones that part owns (`findingsFor`): a shared condition such as a riser
 * requirement is listed once, on the part whose data caused it.
 */
function summarizeDecision(
  evidence: FitmentEvidence[],
  ignored: ReadonlySet<string>,
  findingsFor: SelectableKind | null,
): FitmentSummary {
  const active = evidence.filter(
    (item) => item.verdict !== "conditional" || !ignored.has(item.code),
  );
  const owned = findingsFor
    ? active.filter((item) => item.subject === findingsFor)
    : active;
  const issues: BuildViewIssue[] = [];
  for (const item of evidence) {
    if (item.verdict === "pass" || !item.message) continue;
    if (findingsFor && item.subject !== findingsFor) continue;
    // A stored code for a hard conflict stays inert: fails are never ignored.
    const dismissible = item.verdict === "conditional";
    issues.push({
      code: item.code,
      title: issueTitle(item.code, item.message),
      message: item.message,
      verdict: item.verdict,
      dismissible,
      ignored: dismissible && ignored.has(item.code),
    });
  }

  return {
    verdict: summarizeEvidence(active),
    messages: owned
      .filter((e) => e.message && e.verdict !== "pass" && !e.advisory)
      .map((e) => e.message),
    notes: owned.filter((e) => e.advisory && e.message).map((e) => e.message),
    cellEvidence: owned.filter((e) => e.metric),
    issues,
  };
}

function emptyToDash(value: string) {
  return value && !isBlankSpec(value) ? value : "—";
}

function ratioFromLimit(value: number | null | undefined, ceiling: number) {
  if (!value) return 0.34;
  return Math.max(0.12, Math.min(0.94, value / ceiling));
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
  if (isCasePart(part)) return part.style || part.sourceSheet;
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
        psuTierBadge(part),
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
      { label: "Motherboard", value: part.motherboard || "-" },
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
      ["Rating", psuTierBadge(part) || "-"],
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

function psuTierLabel(part: GenericPart) {
  const tier = specValue(part, ["psu_tier"]);
  const efficiency = formatPsuEfficiency(
    specValue(part, ["psu_tier_efficiency", "efficiency_80plus", "efficiency"]),
  );
  if (efficiency && tier) return `${efficiency} · Tier ${tier}`;
  if (efficiency) return efficiency;
  return tier ? `Tier ${tier}` : "";
}

function formatPsuEfficiency(value: string) {
  const code = value.trim().toUpperCase();
  const efficiencyCodes: Record<string, string> = {
    T: "Titanium",
    P: "Platinum",
    G: "Gold",
    S: "Silver",
    B: "Bronze",
    W: "White",
  };
  if (efficiencyCodes[code]) return efficiencyCodes[code];

  const normalized = value
    .replace(/80\s*\+|80\s*plus/gi, "")
    .replace(/cybenetics\s+eta/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized === "-") return "";
  return normalized
    .toLowerCase()
    .split(/([\s/-]+)/)
    .map((part) =>
      /^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join("");
}

function psuTierGrade(part: GenericPart): string {
  const tier = specValue(part, ["psu_tier"]);
  if (!tier) return "unknown";
  const match = tier.match(/^([A-F][+-]?)/i);
  return match ? match[1].toUpperCase() : "unknown";
}

function matchesPsuTierFilter(part: GenericPart, filter: PsuTierFilter) {
  const target = PSU_TIER_FILTERS.find((option) => option.value === filter);
  if (!target) return true;
  const rank = psuTierRank(psuTierGrade(part));
  return rank <= target.maxRank;
}

function matchesPsuFormFactorFilter(
  part: GenericPart,
  filter: PsuFormFactorFilter,
) {
  const tokens = parseSupportTokens(specValue(part, ["form_factor", "psu"]), psuTokenAliases);
  const canonicalFilter = canonicalPsuFormFilter(filter);
  return tokens.has(canonicalFilter);
}

function matchesPsuFeatureFilter(part: GenericPart, filter: PsuFeatureFilter) {
  if (filter === "atx-3") return yesNoValue(part, ["atx_3_compatible"]) === "Yes";
  if (filter === "12vhpwr") {
    const count = dimensionOrSpecNumber(part, [
      "cable_12vhpwr_count",
      "12vhpwr_12v_2x6_connectors",
    ]);
    if (count !== null) return count > 0;
    return !isBlankSpec(specValue(part, ["12vhpwr_12v_2x6_connectors"]));
  }
  if (filter === "fully-modular") {
    return /fully|full|modular/i.test(specValue(part, ["modular"]));
  }
  if (filter === "semi-passive") return yesNoValue(part, ["semi_passive"]) === "Yes";
  return true;
}

function canonicalPsuFormFilter(filter: PsuFormFactorFilter) {
  if (filter === "sfx-l") return "sfxl";
  if (filter === "flex-atx") return "flexatx";
  return filter;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function psuEfficiencyLevel(
  part: GenericPart,
): "premium" | "good" | "standard" | "unknown" {
  const eff = formatPsuEfficiency(
    specValue(part, [
      "psu_tier_efficiency",
      "efficiency_80plus",
      "efficiency",
    ]),
  );
  if (!eff) return "unknown";
  if (eff === "Titanium" || eff === "Platinum") return "premium";
  if (eff === "Gold") return "good";
  return "standard";
}

type PsuEfficiencyLevel = "premium" | "good" | "standard" | "unknown";

// Icon + bg indices for every (grade, efficiency) combination.
// bg: 0=subtle tint, 1=medium tint, 2=strong tint.
// icon: higher = darker/richer against the theme base-content.
const PSU_BADGE_INDICES: Record<string, Record<PsuEfficiencyLevel, { icon: number; bg: number }>> = {
  "A+": { premium: { icon: 9, bg: 2 }, good: { icon: 8, bg: 1 }, standard: { icon: 5, bg: 0 }, unknown: { icon: 5, bg: 0 } },
  "A":  { premium: { icon: 8, bg: 2 }, good: { icon: 7, bg: 1 }, standard: { icon: 4, bg: 0 }, unknown: { icon: 4, bg: 0 } },
  "A-": { premium: { icon: 7, bg: 1 }, good: { icon: 6, bg: 0 }, standard: { icon: 3, bg: 0 }, unknown: { icon: 3, bg: 0 } },
  "B+": { premium: { icon: 9, bg: 2 }, good: { icon: 8, bg: 1 }, standard: { icon: 5, bg: 0 }, unknown: { icon: 5, bg: 0 } },
  "B":  { premium: { icon: 8, bg: 2 }, good: { icon: 7, bg: 1 }, standard: { icon: 4, bg: 0 }, unknown: { icon: 4, bg: 0 } },
  "B-": { premium: { icon: 7, bg: 1 }, good: { icon: 5, bg: 0 }, standard: { icon: 3, bg: 0 }, unknown: { icon: 3, bg: 0 } },
  "C+": { premium: { icon: 8, bg: 2 }, good: { icon: 7, bg: 1 }, standard: { icon: 6, bg: 0 }, unknown: { icon: 6, bg: 0 } },
  "C":  { premium: { icon: 7, bg: 2 }, good: { icon: 6, bg: 1 }, standard: { icon: 5, bg: 0 }, unknown: { icon: 5, bg: 0 } },
  "C-": { premium: { icon: 6, bg: 1 }, good: { icon: 5, bg: 0 }, standard: { icon: 4, bg: 0 }, unknown: { icon: 4, bg: 0 } },
  "D":  { premium: { icon: 8, bg: 2 }, good: { icon: 7, bg: 1 }, standard: { icon: 6, bg: 0 }, unknown: { icon: 6, bg: 0 } },
  "E":  { premium: { icon: 9, bg: 2 }, good: { icon: 8, bg: 1 }, standard: { icon: 7, bg: 0 }, unknown: { icon: 7, bg: 0 } },
  "F":  { premium: { icon: 9, bg: 2 }, good: { icon: 8, bg: 1 }, standard: { icon: 6, bg: 0 }, unknown: { icon: 6, bg: 0 } },
};

/** Map a PSU grade to a theme-respecting hue using Tailwind semantic colors. */
function psuTierHue(grade: string): string {
  const letter = grade[0] ?? "";
  if (letter === "A") return "var(--color-success)";
  if (letter === "B") return "color-mix(in oklab, var(--color-success) 30%, var(--color-info) 70%)";
  if (letter === "C") return "var(--color-warning)";
  if (letter === "D") return "color-mix(in oklab, var(--color-warning) 55%, var(--color-error) 45%)";
  if (letter === "E" || letter === "F") return "var(--color-error)";
  return "var(--color-base-content)";
}

/** Background tint intensity derived from the efficiency level. */
function psuTierBgColor(hue: string, bgIndex: number): string {
  const mix = bgIndex === 2 ? "20%" : bgIndex === 1 ? "12%" : "6%";
  const base = bgIndex === 0 ? "transparent" : "var(--color-base-100)";
  return `color-mix(in oklab, ${hue} ${mix}, ${base})`;
}

/** Icon color darkness/richness derived from the icon index. */
function psuTierIconColor(hue: string, iconIndex: number): string {
  if (hue === "var(--color-base-content)") {
    // Neutral/unknown: vary opacity against transparent
    const opacity = 35 + iconIndex * 6;
    return `color-mix(in oklab, var(--color-base-content) ${opacity}%, transparent)`;
  }
  const pct = 25 + iconIndex * 7;
  return `color-mix(in oklab, ${hue} ${pct}%, var(--color-base-content))`;
}

function psuTierBadgeMeta(grade: string, efficiency: PsuEfficiencyLevel) {
  const letter = grade[0] ?? "";
  const hue = psuTierHue(grade);
  const idx = PSU_BADGE_INDICES[grade]?.[efficiency] ?? { icon: 4, bg: 0 };

  const bgColor = psuTierBgColor(hue, idx.bg);
  const iconColor = psuTierIconColor(hue, idx.icon);

  // Icon chosen by efficiency + tier
  const isHighTier = letter === "A" || letter === "B";
  const isPremiumCombo = efficiency === "premium" && letter === "A";
  const isGoodCombo =
    (efficiency === "premium" && letter === "B") ||
    (efficiency === "good" && isHighTier);

  let iconSvg: string;
  if (isPremiumCombo) {
    // Premium: filled star
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4-6.5 4 2-7L2 9h7z" fill="currentColor" stroke="currentColor"/></svg>`;
  } else if (isGoodCombo) {
    // Good: shield with star
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 9l1 2h2l-1.5 1.2.6 2.3-1.7-1.3-1.7 1.3.6-2.3L9 11h2z" fill="currentColor" stroke="none"/></svg>`;
  } else if (isHighTier) {
    // Standard high tier: shield with check
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 12 15 17 10"/></svg>`;
  } else if (letter === "C") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  } else if (letter === "D" || letter === "E" || letter === "F") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }

  return { iconColor, bgColor, iconSvg };
}

function psuTierBadge(part: GenericPart): string {
  const label = psuTierLabel(part);
  if (!label) return "—";
  const grade = psuTierGrade(part);
  const efficiency = psuEfficiencyLevel(part);
  const { iconSvg, iconColor, bgColor } = psuTierBadgeMeta(grade, efficiency);
  return `<span data-psu-tier-badge data-psu-tier-bg="${bgColor}" class="inline-flex items-center gap-1.5 text-base-content"><span class="inline-flex items-center justify-center w-[1.125rem] h-[1.125rem] rounded-sm" style="background-color:${bgColor};color:${iconColor}">${iconSvg}</span><span>${escapeHtml(label)}</span></span>`;
}
