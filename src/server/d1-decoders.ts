import type {
  CasePart,
  GenericPart,
  GpuPart,
  PartKind,
  RawScalar,
  SelectableKind,
  SelectablePartByKind,
} from "../types";

export type D1Row = Record<string, unknown>;

export const SELECTABLE_TABLES: Record<SelectableKind, string> = {
  case: "cases",
  gpu: "gpus",
  "cpu-cooler": "cpu_coolers",
  motherboard: "motherboards",
  psu: "psus",
  ram: "ram",
};

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanish(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function scalar(value: unknown): RawScalar {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function generic(row: D1Row, kind: PartKind): GenericPart {
  const specs: Record<string, string> = {};
  const dimensions: Record<string, number> = {};
  const raw: Record<string, RawScalar> = {};

  for (const [key, value] of Object.entries(row)) {
    raw[key] = scalar(value);
    if (typeof value === "number" && Number.isFinite(value)) {
      dimensions[key] = value;
      const stripped = key.replace(/_(mm|w|g|count|rpm|cfm|dba|gbps|mhz|mbps|v|a|kg|l|cm2)$/, "");
      if (stripped !== key) dimensions[stripped] = value;
    } else if (typeof value === "string" && value !== "") {
      specs[key] = value;
    } else if (typeof value === "boolean") {
      specs[key] = value ? "Y" : "-";
    }
  }

  const brand = text(row.brand);
  const name = text(row.name || row.model);
  return {
    id: text(row.id), kind, sourceSheet: text(row.source_sheet),
    rowNumber: Number(row.source_row_number ?? 0), brand, name,
    displayName: `${brand} ${name}`.trim(), status: text(row.status),
    availabilityStatus: text(row.availability_status) === "unavailable" ? "unavailable" : "available",
    sellerUrl: "", productUrl: "", specs, dimensions, releaseYear: nullableNumber(row.release_year),
    flags: [], raw, links: {},
  };
}

function decodeCase(row: D1Row): CasePart {
  return {
    kind: "case", id: text(row.id), sourceSheet: text(row.source_sheet), rowNumber: Number(row.source_row_number ?? 0),
    seller: text(row.seller), name: text(row.name), style: text(row.style), sidePanel: text(row.side_panel), caseMaterial: text(row.case_material),
    status: text(row.status), availabilityStatus: text(row.availability_status) === "unavailable" ? "unavailable" : "available",
    gpuRiser: text(row.gpu_riser), psu: text(row.psu), motherboard: text(row.motherboard), radiatorSupportRaw: text(row.radiator_support_raw), sffNetLink: text(row.sff_net_link), lastUpdate: text(row.last_update),
    dimensions: { lengthMm: nullableNumber(row.length_mm), widthMm: nullableNumber(row.width_mm), heightMm: nullableNumber(row.height_mm), volumeL: nullableNumber(row.volume_l), footprintCm2: nullableNumber(row.footprint_cm2), weightKg: nullableNumber(row.weight_kg), cpuCoolerHeightMm: nullableNumber(row.cpu_cooler_height_mm), gpuLengthMm: nullableNumber(row.gpu_length_mm), gpuWidthMm: nullableNumber(row.gpu_width_mm), gpuThicknessMm: nullableNumber(row.gpu_height_mm), pcieSlots: nullableNumber(row.pcie_slots), lpPcieSlots: nullableNumber(row.lp_pcie_slots) },
    counts: { drive25Max: nullableNumber(row.drive_2_5_max), drive35Max: nullableNumber(row.drive_3_5_max), drive525Max: nullableNumber(row.drive_5_25_max), fan40mm: nullableNumber(row.fan_40mm_count), fan60mm: nullableNumber(row.fan_60mm_count), fan80mm: nullableNumber(row.fan_80mm_count), fan92mm: nullableNumber(row.fan_92mm_count), fan120mm: nullableNumber(row.fan_120mm_count), fan140mm: nullableNumber(row.fan_140mm_count), fan180mm: nullableNumber(row.fan_180mm_count), fan200mm: nullableNumber(row.fan_200mm_count), usbA20: nullableNumber(row.usb_a_2_0_count), usbA32: nullableNumber(row.usb_a_3_2_count), usbC: nullableNumber(row.usb_c_count) },
    radiatorFlags: { has120mm: booleanish(row.radiator_120mm), has140mm: booleanish(row.radiator_140mm), has200mm: booleanish(row.radiator_200mm), has240mm: booleanish(row.radiator_240mm), has280mm: booleanish(row.radiator_280mm), has360mm: booleanish(row.radiator_360mm), has420mm: booleanish(row.radiator_420mm), hasTopHat: booleanish(row.radiator_top_hat) },
    hasJack35mm: booleanish(row.jack_3_5mm), priceCny: nullableNumber(row.price_cny), priceUsd: nullableNumber(row.price_usd), releaseYear: nullableNumber(row.release_year), flags: [], raw: {},
  };
}

function decodeGpu(row: D1Row): GpuPart {
  return {
    kind: "gpu", id: text(row.id), sourceSheet: text(row.source_sheet), rowNumber: Number(row.source_row_number ?? 0), chipset: text(row.chipset), model: text(row.model), brand: text(row.brand), name: text(row.name), lowProfile: booleanish(row.low_profile), watercooled: booleanish(row.watercooled), blower: booleanish(row.blower), pciePins: text(row.pcie_pins), tdpW: nullableNumber(row.tdp_w), boostClockMhz: nullableNumber(row.boost_clock_mhz), memorySpeedGbps: nullableNumber(row.memory_speed_gbps), fanCount: nullableNumber(row.fan_count), displayportCount: nullableNumber(row.displayport_count), hdmiCount: nullableNumber(row.hdmi_count), usbCCount: nullableNumber(row.usb_c_count), dviD: booleanish(row.dvi_d), remarks: text(row.remarks), availabilityStatus: text(row.availability_status) === "unavailable" ? "unavailable" : "available", dimensions: { lengthMm: nullableNumber(row.length_mm), widthMm: nullableNumber(row.width_mm), thicknessMm: nullableNumber(row.thickness_mm), pcieSlots: nullableNumber(row.pcie_bracket) }, releaseYear: nullableNumber(row.release_year), flags: [], raw: {},
  };
}

function decodeCpuCooler(row: D1Row): SelectablePartByKind["cpu-cooler"] {
  const part = generic(row, "cpu-cooler");
  // `ram_clearance_mm` remains the numeric dimension used for comparisons,
  // while the raw column is the authoritative display/spec value (including
  // the literal "No limit"). The engine's existing ram_clearance lookup can
  // therefore consume both representations without database-shape knowledge.
  const rawClearance = text(row.ram_clearance_raw).trim();
  if (rawClearance) part.specs.ram_clearance = rawClearance;
  return part as SelectablePartByKind["cpu-cooler"];
}

export const SELECTABLE_DECODERS: { [K in SelectableKind]: (row: D1Row) => SelectablePartByKind[K] } = {
  case: decodeCase,
  gpu: decodeGpu,
  "cpu-cooler": decodeCpuCooler,
  motherboard: (row) => generic(row, "motherboard") as SelectablePartByKind["motherboard"],
  psu: (row) => generic(row, "psu") as SelectablePartByKind["psu"],
  ram: (row) => generic(row, "ram") as SelectablePartByKind["ram"],
};

export function decodeSelectable<K extends SelectableKind>(kind: K, row: D1Row): SelectablePartByKind[K] {
  return SELECTABLE_DECODERS[kind](row);
}

export function decodeCatalogRow(row: D1Row, kind: PartKind): GenericPart | CasePart | GpuPart {
  if (kind in SELECTABLE_DECODERS) {
    return decodeSelectable(kind as SelectableKind, row);
  }
  return generic(row, kind);
}
