import type { CasePart, GenericPart, GpuPart, IntakeResult } from "../types";

function escapeSql(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function json(value: unknown) {
  return escapeSql(JSON.stringify(value));
}

function bool(value: boolean) {
  return value ? "1" : "0";
}

function dim(part: GenericPart, keys: string[]) {
  for (const key of keys) {
    const value = part.dimensions[key];
    if (value !== undefined) return value;
  }
  return null;
}

function spec(part: GenericPart, keys: string[]) {
  for (const key of keys) {
    const value = part.specs[key]?.trim();
    if (value) return value;
  }
  return "";
}

function genericPartInsert(runId: string, part: GenericPart, casePart?: CasePart, gpuPart?: GpuPart) {
  const caseDimensions = casePart?.dimensions;
  const gpuDimensions = gpuPart?.dimensions;

  return `insert into sff_parts (${[
    "id",
    "import_run_id",
    "kind",
    "source_sheet",
    "source_row_number",
    "brand",
    "name",
    "display_name",
    "status",
    "seller_url",
    "product_url",
    "length_mm",
    "width_mm",
    "height_mm",
    "thickness_mm",
    "volume_l",
    "weight_g",
    "case_seller",
    "case_style",
    "case_gpu_riser",
    "case_psu",
    "case_cpu_cooler_height_mm",
    "case_gpu_length_mm",
    "case_gpu_width_mm",
    "case_gpu_thickness_mm",
    "case_pcie_slots",
    "case_lp_pcie_slots",
    "gpu_chipset",
    "gpu_model",
    "gpu_brand",
    "gpu_name",
    "gpu_low_profile",
    "gpu_watercooled",
    "gpu_pcie_pins",
    "gpu_tdp_w",
    "gpu_pcie_slots",
    "cooler_height_mm",
    "fan_size_mm",
    "psu_form_factor",
    "psu_wattage",
    "motherboard_form_factor",
    "ram_height_mm",
    "specs_json",
    "dimensions_json",
    "flags_json",
    "raw_json",
    "links_json"
  ].join(", ")}) values (${[
    escapeSql(part.id),
    escapeSql(runId),
    escapeSql(part.kind),
    escapeSql(part.sourceSheet),
    escapeSql(part.rowNumber),
    escapeSql(part.brand),
    escapeSql(part.name),
    escapeSql(part.displayName),
    escapeSql(part.status),
    escapeSql(part.sellerUrl),
    escapeSql(part.productUrl),
    escapeSql(caseDimensions?.lengthMm ?? gpuDimensions?.lengthMm ?? dim(part, ["case_length", "length"])),
    escapeSql(caseDimensions?.widthMm ?? gpuDimensions?.widthMm ?? dim(part, ["case_width", "width"])),
    escapeSql(caseDimensions?.heightMm ?? dim(part, ["case_height", "height"])),
    escapeSql(gpuDimensions?.thicknessMm ?? dim(part, ["thickness", "gpu_height_thickness"])),
    escapeSql(caseDimensions?.volumeL ?? dim(part, ["volume"])),
    escapeSql(dim(part, ["weight"])),
    escapeSql(casePart?.seller ?? ""),
    escapeSql(casePart?.style ?? ""),
    escapeSql(casePart?.gpuRiser ?? ""),
    escapeSql(casePart?.psu ?? ""),
    escapeSql(caseDimensions?.cpuCoolerHeightMm ?? null),
    escapeSql(caseDimensions?.gpuLengthMm ?? null),
    escapeSql(caseDimensions?.gpuWidthMm ?? null),
    escapeSql(caseDimensions?.gpuThicknessMm ?? null),
    escapeSql(caseDimensions?.pcieSlots ?? null),
    escapeSql(caseDimensions?.lpPcieSlots ?? null),
    escapeSql(gpuPart?.chipset ?? ""),
    escapeSql(gpuPart?.model ?? ""),
    escapeSql(gpuPart?.brand ?? ""),
    escapeSql(gpuPart?.name ?? ""),
    bool(gpuPart?.lowProfile ?? false),
    bool(gpuPart?.watercooled ?? false),
    escapeSql(gpuPart?.pciePins ?? ""),
    escapeSql(gpuPart?.tdpW ?? null),
    escapeSql(gpuDimensions?.pcieSlots ?? null),
    escapeSql(dim(part, ["height", "cooler_height"])),
    escapeSql(dim(part, ["size", "fan_size"])),
    escapeSql(spec(part, ["form_factor", "psu"])),
    escapeSql(dim(part, ["wattage", "watt", "watts"])),
    escapeSql(spec(part, ["form_factor", "size"])),
    escapeSql(part.kind === "ram" ? dim(part, ["height"]) : null),
    json(part.specs),
    json(part.dimensions),
    json(part.flags),
    json(part.raw),
    json(part.links)
  ].join(", ")});`;
}

export function buildSeedSql(result: IntakeResult) {
  const runId = `import-${result.generatedAt.replace(/[^0-9a-z]/gi, "-").toLowerCase()}`;
  const casesBySourceRow = new Map(result.cases.map((part) => [`${part.sourceSheet}:${part.rowNumber}`, part]));
  const gpusBySourceRow = new Map(result.gpus.map((part) => [`${part.sourceSheet}:${part.rowNumber}`, part]));
  const lines = [
    "delete from sff_parts;",
    "delete from import_runs;",
    `insert into import_runs (id, source, started_at, completed_at, part_count, warning_count) values (${[
      escapeSql(runId),
      escapeSql("sff-master-list-google-sheets"),
      escapeSql(result.generatedAt),
      escapeSql(new Date().toISOString()),
      escapeSql(result.parts.length),
      escapeSql(result.warnings.length)
    ].join(", ")});`,
    ...result.parts.map((part) =>
      genericPartInsert(
        runId,
        part,
        casesBySourceRow.get(`${part.sourceSheet}:${part.rowNumber}`),
        gpusBySourceRow.get(`${part.sourceSheet}:${part.rowNumber}`)
      )
    )
  ];

  return lines.join("\n");
}
