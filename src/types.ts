export type PartKind =
  | "case"
  | "gpu"
  | "cpu-cooler"
  | "aio"
  | "fan"
  | "ram"
  | "pcie-riser"
  | "motherboard"
  | "psu"
  | "cpu"
  | "chipset"
  | "wifi"
  | "storage"
  | "radiator"
  | "prebuilt"
  | "reference"
  | "unknown";

export type AvailabilityStatus = "available" | "unavailable";

export type FitVerdict = "pass" | "fail" | "conditional";

export type RawScalar = string | number | boolean | null;

export interface RawSheetRow {
  sourceSheet: string;
  rowNumber: number;
  values: Record<string, string>;
  links: Record<string, string>;
}

export interface GenericPart {
  id: string;
  kind: PartKind;
  sourceSheet: string;
  rowNumber: number;
  brand: string;
  name: string;
  displayName: string;
  status: string;
  availabilityStatus: AvailabilityStatus;
  sellerUrl: string;
  productUrl: string;
  specs: Record<string, string>;
  dimensions: Record<string, number>;
  releaseYear: number | null;
  flags: string[];
  raw: Record<string, RawScalar>;
  links: Record<string, string>;
}

export interface PsuTierOverride {
  /** The part id (slug) of the PSU GenericPart that could not be matched deterministically. */
  partId: string;
  /** The rowId of the PsuTierEntry selected by Gemini (or manual override). */
  rowId: string;
  /** Human-readable explanation from the matching agent. */
  reason: string;
  /** Confidence score (0-1) from the matching agent. Only used when >= confidenceThreshold. */
  confidence: number;
  /** ISO timestamp of when this override was created. */
  matchedAt: string;
}

export interface PsuTierEntry {
  sourceSheet: string;
  rowNumber: number;
  rowId: string;
  brand: string;
  series: string;
  qualifier: string;
  variant: string;
  wattages: string;
  tier: string;
  tierRank: number | null;
  introYear: string;
  formFactor: string;
  atxVersion: string;
  inputRange: string;
  modularity: string;
  efficiency: string;
  primaryTopology: string;
  secondaryRectifier: string;
  regulation: string;
  odm: string;
  platform: string;
  notes: string;
  displayName: string;
  matchKeys: string[];
  raw: Record<string, string>;
}

export interface CasePart {
  kind: "case";
  id: string;
  sourceSheet: string;
  rowNumber: number;
  seller: string;
  name: string;
  style: string;
  sidePanel: string;
  caseMaterial: string;
  status: string;
  availabilityStatus: AvailabilityStatus;
  gpuRiser: string;
  psu: string;
  motherboard: string;
  radiatorSupportRaw: string;
  sffNetLink: string;
  lastUpdate: string;
  dimensions: {
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
    volumeL: number | null;
    footprintCm2: number | null;
    weightKg: number | null;
    cpuCoolerHeightMm: number | null;
    gpuLengthMm: number | null;
    gpuWidthMm: number | null;
    gpuThicknessMm: number | null;
    pcieSlots: number | null;
    lpPcieSlots: number | null;
  };
  counts: {
    drive25Max: number | null;
    drive35Max: number | null;
    drive525Max: number | null;
    fan40mm: number | null;
    fan60mm: number | null;
    fan80mm: number | null;
    fan92mm: number | null;
    fan120mm: number | null;
    fan140mm: number | null;
    fan180mm: number | null;
    fan200mm: number | null;
    usbA20: number | null;
    usbA32: number | null;
    usbC: number | null;
  };
  radiatorFlags: {
    has120mm: boolean;
    has140mm: boolean;
    has200mm: boolean;
    has240mm: boolean;
    has280mm: boolean;
    has360mm: boolean;
    has420mm: boolean;
    hasTopHat: boolean;
  };
  hasJack35mm: boolean;
  priceCny: number | null;
  priceUsd: number | null;
  releaseYear: number | null;
  flags: string[];
  raw: Record<string, RawScalar>;
}

export interface GpuPart {
  kind: "gpu";
  id: string;
  sourceSheet: string;
  rowNumber: number;
  chipset: string;
  model: string;
  brand: string;
  name: string;
  lowProfile: boolean;
  watercooled: boolean;
  blower: boolean;
  pciePins: string;
  tdpW: number | null;
  boostClockMhz: number | null;
  memorySpeedGbps: number | null;
  fanCount: number | null;
  displayportCount: number | null;
  hdmiCount: number | null;
  usbCCount: number | null;
  dviD: boolean;
  remarks: string;
  availabilityStatus: AvailabilityStatus;
  dimensions: {
    lengthMm: number | null;
    widthMm: number | null;
    thicknessMm: number | null;
    pcieSlots: number | null;
  };
  releaseYear: number | null;
  flags: string[];
  raw: Record<string, RawScalar>;
}

export type SffPart = CasePart | GpuPart;

/** The closed set of kinds that may be selected in the build. */
export type SelectableKind =
  | "case"
  | "gpu"
  | "cpu-cooler"
  | "motherboard"
  | "psu"
  | "ram";

export type GenericPartForKind<K extends Exclude<SelectableKind, "case" | "gpu">> =
  GenericPart & { kind: K };

export interface SelectablePartByKind {
  case: CasePart;
  gpu: GpuPart;
  "cpu-cooler": GenericPartForKind<"cpu-cooler">;
  motherboard: GenericPartForKind<"motherboard">;
  psu: GenericPartForKind<"psu">;
  ram: GenericPartForKind<"ram">;
}

export type SelectablePart = SelectablePartByKind[SelectableKind];

/** A selected catalog reference that could not be resolved yet. */
export interface UnresolvedSelectedPart {
  status: "unresolved";
  kind: SelectableKind;
  id: string;
}

export interface IntakeResult {
  generatedAt: string;
  rawRows: RawSheetRow[];
  parts: GenericPart[];
  cases: CasePart[];
  gpus: GpuPart[];
  psuTierEntries: PsuTierEntry[];
  warnings: string[];
}

export interface CompatibilityIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface CompatibilityResult {
  verdict: FitVerdict;
  issues: CompatibilityIssue[];
  clearances: {
    gpuLengthMm: number | null;
    gpuWidthMm: number | null;
    gpuThicknessMm: number | null;
    pcieSlots: number | null;
  };
}
