import type { CasePart, GenericPart, GpuPart, IntakeResult, RawSheetRow } from "../types";

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

function caseInsert(runId: string, part: CasePart) {
  const d = part.dimensions;
  return `insert into cases (id, import_run_id, source_sheet, row_number, seller, name, style, status, case_length_mm, case_width_mm, case_height_mm, volume_l, cpu_cooler_height_mm, gpu_length_mm, gpu_width_mm, gpu_thickness_mm, pcie_slots, lp_pcie_slots, gpu_riser, psu, flags_json, raw_json) values (${[
    escapeSql(part.id),
    escapeSql(runId),
    escapeSql(part.sourceSheet),
    escapeSql(part.rowNumber),
    escapeSql(part.seller),
    escapeSql(part.name),
    escapeSql(part.style),
    escapeSql(part.status),
    escapeSql(d.lengthMm),
    escapeSql(d.widthMm),
    escapeSql(d.heightMm),
    escapeSql(d.volumeL),
    escapeSql(d.cpuCoolerHeightMm),
    escapeSql(d.gpuLengthMm),
    escapeSql(d.gpuWidthMm),
    escapeSql(d.gpuThicknessMm),
    escapeSql(d.pcieSlots),
    escapeSql(d.lpPcieSlots),
    escapeSql(part.gpuRiser),
    escapeSql(part.psu),
    json(part.flags),
    json(part.raw)
  ].join(", ")});`;
}

function gpuInsert(runId: string, part: GpuPart) {
  const d = part.dimensions;
  return `insert into gpus (id, import_run_id, source_sheet, row_number, chipset, model, brand, name, length_mm, width_mm, thickness_mm, pcie_slots, low_profile, watercooled, pcie_pins, tdp_w, flags_json, raw_json) values (${[
    escapeSql(part.id),
    escapeSql(runId),
    escapeSql(part.sourceSheet),
    escapeSql(part.rowNumber),
    escapeSql(part.chipset),
    escapeSql(part.model),
    escapeSql(part.brand),
    escapeSql(part.name),
    escapeSql(d.lengthMm),
    escapeSql(d.widthMm),
    escapeSql(d.thicknessMm),
    escapeSql(d.pcieSlots),
    bool(part.lowProfile),
    bool(part.watercooled),
    escapeSql(part.pciePins),
    escapeSql(part.tdpW),
    json(part.flags),
    json(part.raw)
  ].join(", ")});`;
}

function rawInsert(runId: string, row: RawSheetRow) {
  const kind = row.sourceSheet.toLowerCase().includes("gpu") ? "gpu" : "case";
  const id = `${runId}-${kind}-${row.sourceSheet}-${row.rowNumber}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `insert into raw_sheet_rows (id, import_run_id, part_kind, source_sheet, row_number, row_json) values (${[
    escapeSql(id),
    escapeSql(runId),
    escapeSql(kind),
    escapeSql(row.sourceSheet),
    escapeSql(row.rowNumber),
    json(row.values)
  ].join(", ")});`;
}

function genericPartInsert(runId: string, part: GenericPart) {
  return `insert into sff_parts (id, import_run_id, kind, source_sheet, row_number, brand, name, display_name, status, flags_json, raw_json) values (${[
    escapeSql(part.id),
    escapeSql(runId),
    escapeSql(part.kind),
    escapeSql(part.sourceSheet),
    escapeSql(part.rowNumber),
    escapeSql(part.brand),
    escapeSql(part.name),
    escapeSql(part.displayName),
    escapeSql(part.status),
    json(part.flags),
    json(part.raw)
  ].join(", ")});`;
}

function genericSpecInsert(part: GenericPart, key: string, value: string) {
  const id = `${part.id}-spec-${key}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `insert into sff_part_specs (id, part_id, spec_key, spec_value) values (${[
    escapeSql(id),
    escapeSql(part.id),
    escapeSql(key),
    escapeSql(value)
  ].join(", ")});`;
}

function genericDimensionInsert(part: GenericPart, key: string, value: number) {
  const id = `${part.id}-dimension-${key}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `insert into sff_part_dimensions (id, part_id, dimension_key, value) values (${[
    escapeSql(id),
    escapeSql(part.id),
    escapeSql(key),
    escapeSql(value)
  ].join(", ")});`;
}

function genericSourceRowInsert(runId: string, row: RawSheetRow, partKind: string, index: number) {
  const id = `${runId}-${partKind}-${index + 1}-${row.sourceSheet}-${row.rowNumber}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `insert into sff_part_source_rows (id, import_run_id, part_kind, source_sheet, row_number, row_json) values (${[
    escapeSql(id),
    escapeSql(runId),
    escapeSql(partKind),
    escapeSql(row.sourceSheet),
    escapeSql(row.rowNumber),
    json(row.values)
  ].join(", ")});`;
}

export function buildSeedSql(result: IntakeResult) {
  const runId = `import-${result.generatedAt.replace(/[^0-9a-z]/gi, "-").toLowerCase()}`;
  const partKindBySourceRow = new Map(result.parts.map((part) => [`${part.sourceSheet}:${part.rowNumber}`, part.kind]));
  const lines = [
    "delete from sff_part_dimensions;",
    "delete from sff_part_specs;",
    "delete from sff_part_source_rows;",
    "delete from sff_parts;",
    "delete from raw_sheet_rows;",
    "delete from cases;",
    "delete from gpus;",
    "delete from import_runs;",
    `insert into import_runs (id, source, started_at, completed_at, case_count, gpu_count, warning_count) values (${[
      escapeSql(runId),
      escapeSql("sff-master-list-google-sheets"),
      escapeSql(result.generatedAt),
      escapeSql(new Date().toISOString()),
      escapeSql(result.cases.length),
      escapeSql(result.gpus.length),
      escapeSql(result.warnings.length)
    ].join(", ")});`,
    ...result.parts.map((part) => genericPartInsert(runId, part)),
    ...result.parts.flatMap((part) => Object.entries(part.specs).map(([key, value]) => genericSpecInsert(part, key, value))),
    ...result.parts.flatMap((part) =>
      Object.entries(part.dimensions).map(([key, value]) => genericDimensionInsert(part, key, value))
    ),
    ...result.rawRows.map((row, index) =>
      genericSourceRowInsert(runId, row, partKindBySourceRow.get(`${row.sourceSheet}:${row.rowNumber}`) ?? "unknown", index)
    ),
    ...result.cases.map((part) => caseInsert(runId, part)),
    ...result.gpus.map((part) => gpuInsert(runId, part)),
    ...result.rawRows
      .filter((row) => row.sourceSheet.toLowerCase().includes("gpu") || row.sourceSheet.toLowerCase().includes("case"))
      .map((row) => rawInsert(runId, row))
  ];

  return lines.join("\n");
}
