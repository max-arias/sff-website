export type PartKind = "case" | "gpu";

export type FitVerdict = "pass" | "fail" | "conditional";

export interface RawSheetRow {
  sourceSheet: string;
  rowNumber: number;
  values: Record<string, string>;
}

export interface CasePart {
  kind: "case";
  id: string;
  sourceSheet: string;
  rowNumber: number;
  seller: string;
  name: string;
  style: string;
  status: string;
  gpuRiser: string;
  psu: string;
  dimensions: {
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
    volumeL: number | null;
    cpuCoolerHeightMm: number | null;
    gpuLengthMm: number | null;
    gpuWidthMm: number | null;
    gpuThicknessMm: number | null;
    pcieSlots: number | null;
    lpPcieSlots: number | null;
  };
  flags: string[];
  raw: Record<string, string>;
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
  pciePins: string;
  tdpW: number | null;
  dimensions: {
    lengthMm: number | null;
    widthMm: number | null;
    thicknessMm: number | null;
    pcieSlots: number | null;
  };
  flags: string[];
  raw: Record<string, string>;
}

export type SffPart = CasePart | GpuPart;

export interface IntakeResult {
  generatedAt: string;
  rawRows: RawSheetRow[];
  cases: CasePart[];
  gpus: GpuPart[];
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
