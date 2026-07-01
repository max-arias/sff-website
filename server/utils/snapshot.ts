import type { CasePart, GenericPart, GpuPart, IntakeResult, PartKind } from "../../app/types";

export async function readSnapshot(): Promise<IntakeResult> {
  const [{ readFile }, { resolve }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path")
  ]);
  const snapshotPath = resolve(".data/intake-snapshot.json");
  const raw = await readFile(snapshotPath, "utf8");
  return JSON.parse(raw) as IntakeResult;
}

export function rowToCase(row: Record<string, unknown>): CasePart {
  return {
    kind: "case",
    id: String(row.id),
    sourceSheet: String(row.source_sheet),
    rowNumber: Number(row.row_number),
    seller: String(row.seller ?? ""),
    name: String(row.name ?? ""),
    style: String(row.style ?? ""),
    status: String(row.status ?? ""),
    gpuRiser: String(row.gpu_riser ?? ""),
    psu: String(row.psu ?? ""),
    dimensions: {
      lengthMm: nullableNumber(row.case_length_mm),
      widthMm: nullableNumber(row.case_width_mm),
      heightMm: nullableNumber(row.case_height_mm),
      volumeL: nullableNumber(row.volume_l),
      cpuCoolerHeightMm: nullableNumber(row.cpu_cooler_height_mm),
      gpuLengthMm: nullableNumber(row.gpu_length_mm),
      gpuWidthMm: nullableNumber(row.gpu_width_mm),
      gpuThicknessMm: nullableNumber(row.gpu_thickness_mm),
      pcieSlots: nullableNumber(row.pcie_slots),
      lpPcieSlots: nullableNumber(row.lp_pcie_slots)
    },
    flags: JSON.parse(String(row.flags_json ?? "[]")) as string[],
    raw: JSON.parse(String(row.raw_json ?? "{}")) as Record<string, string>
  };
}

export function rowToGpu(row: Record<string, unknown>): GpuPart {
  return {
    kind: "gpu",
    id: String(row.id),
    sourceSheet: String(row.source_sheet),
    rowNumber: Number(row.row_number),
    chipset: String(row.chipset ?? ""),
    model: String(row.model ?? ""),
    brand: String(row.brand ?? ""),
    name: String(row.name ?? ""),
    lowProfile: Boolean(row.low_profile),
    watercooled: Boolean(row.watercooled),
    pciePins: String(row.pcie_pins ?? ""),
    tdpW: nullableNumber(row.tdp_w),
    dimensions: {
      lengthMm: nullableNumber(row.length_mm),
      widthMm: nullableNumber(row.width_mm),
      thicknessMm: nullableNumber(row.thickness_mm),
      pcieSlots: nullableNumber(row.pcie_slots)
    },
    flags: JSON.parse(String(row.flags_json ?? "[]")) as string[],
    raw: JSON.parse(String(row.raw_json ?? "{}")) as Record<string, string>
  };
}

export function rowToGenericPart(row: Record<string, unknown>): GenericPart {
  return {
    id: String(row.id),
    kind: String(row.kind ?? "unknown") as PartKind,
    sourceSheet: String(row.source_sheet),
    rowNumber: Number(row.row_number),
    brand: String(row.brand ?? ""),
    name: String(row.name ?? ""),
    displayName: String(row.display_name ?? ""),
    status: String(row.status ?? ""),
    specs: {},
    dimensions: {},
    flags: JSON.parse(String(row.flags_json ?? "[]")) as string[],
    raw: JSON.parse(String(row.raw_json ?? "{}")) as Record<string, string>
  };
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
