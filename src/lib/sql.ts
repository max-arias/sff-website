import type { CasePart, GenericPart, GpuPart, IntakeResult } from "../types";
import { normalizePsuMatchKey } from "./psu-tier-list";
import { uniqueSlug } from "./slug";

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

function psuPartMatchKeys(part: GenericPart) {
  const names = new Set<string>();
  const brandName = [part.brand, part.name].filter(Boolean).join(" ");

  names.add(part.displayName);
  names.add(part.name);
  names.add(brandName);
  names.add(spec(part, ["name", "model", "psu"]));

  return [...names].map(normalizePsuMatchKey).filter(Boolean);
}

function psuTierByMatchKey(result: IntakeResult) {
  const index = new Map<string, IntakeResult["psuTierEntries"][number] | null>();

  result.psuTierEntries.forEach((entry) => {
    entry.matchKeys.forEach((key) => {
      const existing = index.get(key);
      if (existing === undefined) {
        index.set(key, entry);
      } else if (existing?.rowId !== entry.rowId) {
        index.set(key, null);
      }
    });
  });

  return index;
}

function psuTierForPart(
  part: GenericPart,
  tierIndex: Map<string, IntakeResult["psuTierEntries"][number] | null>
) {
  if (part.kind !== "psu") return null;

  const matches = new Map<string, IntakeResult["psuTierEntries"][number]>();
  psuPartMatchKeys(part).forEach((key) => {
    const entry = tierIndex.get(key);
    if (entry) matches.set(entry.rowId || `${entry.sourceSheet}:${entry.rowNumber}`, entry);
  });

  return matches.size === 1 ? [...matches.values()][0] : null;
}

function motherboardFormFactor(part: GenericPart) {
  const explicit = spec(part, ["form_factor"]);
  if (explicit) return explicit;
  const source = part.sourceSheet.toLowerCase();
  if (source.includes("mitx")) return "mITX";
  if (source.includes("matx")) return "mATX";
  return "";
}

// ---------------------------------------------------------------------------
// Per-table INSERT generators
// ---------------------------------------------------------------------------

export function caseInsert(runId: string, slug: string, part: GenericPart, casePart?: CasePart) {
  const cd = casePart?.dimensions;

  return `insert into cases (${[
    "id",
    "seller",
    "name",
    "style",
    "side_panel",
    "case_material",
    "length_mm",
    "width_mm",
    "height_mm",
    "volume_l",
    "footprint_cm2",
    "weight_kg",
    "cpu_cooler_height_mm",
    "gpu_length_mm",
    "gpu_width_mm",
    "gpu_height_mm",
    "pcie_slots",
    "lp_pcie_slots",
    "gpu_riser",
    "motherboard",
    "psu",
    "radiator_support_raw",
    "radiator_120mm",
    "radiator_140mm",
    "radiator_200mm",
    "radiator_240mm",
    "radiator_280mm",
    "radiator_360mm",
    "radiator_420mm",
    "radiator_top_hat",
    "drive_2_5_max",
    "drive_3_5_max",
    "drive_5_25_max",
    "fan_40mm_count",
    "fan_60mm_count",
    "fan_80mm_count",
    "fan_92mm_count",
    "fan_120mm_count",
    "fan_140mm_count",
    "fan_180mm_count",
    "fan_200mm_count",
    "usb_a_2_0_count",
    "usb_a_3_2_count",
    "usb_c_count",
    "jack_3_5mm",
    "price_cny",
    "price_usd",
    "sff_net_link",
    "status",
    "last_update",
    "created_at",
    "updated_at"
  ].join(", ")}) values (${[
    escapeSql(slug),
    escapeSql(casePart?.seller ?? ""),
    escapeSql(part.name),
    escapeSql(casePart?.style ?? ""),
    escapeSql(spec(part, ["side_panel"])),
    escapeSql(spec(part, ["case_material"])),
    escapeSql(cd?.lengthMm ?? dim(part, ["case_length", "length", "size_height"])),
    escapeSql(cd?.widthMm ?? dim(part, ["case_width", "width", "size_width"])),
    escapeSql(cd?.heightMm ?? dim(part, ["case_height", "height"])),
    escapeSql(cd?.volumeL ?? dim(part, ["volume"])),
    escapeSql(dim(part, ["footprint_cm2"])),
    escapeSql(dim(part, ["weight_kg", "weight"])),
    escapeSql(cd?.cpuCoolerHeightMm ?? null),
    escapeSql(cd?.gpuLengthMm ?? null),
    escapeSql(cd?.gpuWidthMm ?? null),
    escapeSql(cd?.gpuThicknessMm ?? null),
    escapeSql(cd?.pcieSlots ?? null),
    escapeSql(cd?.lpPcieSlots ?? null),
    escapeSql(casePart?.gpuRiser ?? ""),
    escapeSql(spec(part, ["motherboard"])),
    escapeSql(casePart?.psu ?? ""),
    escapeSql(spec(part, ["radiator_support_raw"])),
    bool(
      spec(part, ["radiator_120mm"]) === "Y" ||
        part.flags.includes("radiator_120mm") ||
        part.flags.includes("120mm")
    ),
    bool(
      spec(part, ["radiator_140mm"]) === "Y" ||
        part.flags.includes("radiator_140mm") ||
        part.flags.includes("140mm")
    ),
    bool(
      spec(part, ["radiator_200mm"]) === "Y" ||
        part.flags.includes("radiator_200mm") ||
        part.flags.includes("200mm")
    ),
    bool(
      spec(part, ["radiator_240mm"]) === "Y" ||
        part.flags.includes("radiator_240mm") ||
        part.flags.includes("240mm")
    ),
    bool(
      spec(part, ["radiator_280mm"]) === "Y" ||
        part.flags.includes("radiator_280mm") ||
        part.flags.includes("280mm")
    ),
    bool(
      spec(part, ["radiator_360mm"]) === "Y" ||
        part.flags.includes("radiator_360mm") ||
        part.flags.includes("360mm")
    ),
    bool(
      spec(part, ["radiator_420mm"]) === "Y" ||
        part.flags.includes("radiator_420mm") ||
        part.flags.includes("420mm")
    ),
    bool(
      spec(part, ["radiator_top_hat"]) === "Y" || part.flags.includes("radiator_top_hat")
    ),
    escapeSql(dim(part, ["drive_2_5_max", "drive_25_max", "drive_2_5"])),
    escapeSql(dim(part, ["drive_3_5_max", "drive_35_max", "drive_3_5"])),
    escapeSql(dim(part, ["drive_5_25_max", "drive_525_max", "drive_5_25"])),
    escapeSql(dim(part, ["fan_40mm_count", "fan_40mm", "fan_count_40"])),
    escapeSql(dim(part, ["fan_60mm_count", "fan_60mm", "fan_count_60"])),
    escapeSql(dim(part, ["fan_80mm_count", "fan_80mm", "fan_count_80"])),
    escapeSql(dim(part, ["fan_92mm_count", "fan_92mm", "fan_count_92"])),
    escapeSql(dim(part, ["fan_120mm_count", "fan_120mm", "fan_count_120"])),
    escapeSql(dim(part, ["fan_140mm_count", "fan_140mm", "fan_count_140"])),
    escapeSql(dim(part, ["fan_180mm_count", "fan_180mm", "fan_count_180"])),
    escapeSql(dim(part, ["fan_200mm_count", "fan_200mm", "fan_count_200"])),
    escapeSql(dim(part, ["usb_a_2_0_count", "usb_a_2_0", "usb_2_0_count"])),
    escapeSql(dim(part, ["usb_a_3_2_count", "usb_a_3_2", "usb_3_2_count"])),
    escapeSql(dim(part, ["usb_c_count", "usb_c"])),
    bool(
      spec(part, ["jack_3_5mm"]) === "Y" ||
        dim(part, ["jack_3_5mm"]) === 1 ||
        part.flags.includes("jack_3_5mm")
    ),
    escapeSql(dim(part, ["price_cny"])),
    escapeSql(dim(part, ["price_usd"])),
    escapeSql(spec(part, ["sff_net_link", "link"])),
    escapeSql(part.status ?? ""),
    escapeSql(spec(part, ["last_update"])),
    "current_timestamp",
    "current_timestamp"
  ].join(", ")});`;
}

export function gpuInsert(runId: string, slug: string, part: GenericPart, gpuPart?: GpuPart) {
  const gd = gpuPart?.dimensions;

  return `insert into gpus (${[
    "id",
    "brand",
    "name",
    "model",
    "chipset",
    "length_mm",
    "width_mm",
    "thickness_mm",
    "pcie_bracket",
    "boost_clock_mhz",
    "memory_speed_gbps",
    "tdp_w",
    "pcie_pins",
    "fan_count",
    "displayport_count",
    "hdmi_count",
    "usb_c_count",
    "dvi_d",
    "watercooled",
    "low_profile",
    "blower",
    "remarks",
    "status",
    "created_at",
    "updated_at"
  ].join(", ")}) values (${[
    escapeSql(slug),
    escapeSql(gpuPart?.brand ?? part.brand),
    escapeSql(gpuPart?.name ?? part.name),
    escapeSql(gpuPart?.model ?? spec(part, ["model"])),
    escapeSql(gpuPart?.chipset ?? spec(part, ["chipset"])),
    escapeSql(gd?.lengthMm ?? dim(part, ["gpu_length", "length", "size_height"])),
    escapeSql(gd?.widthMm ?? dim(part, ["gpu_width", "width", "size_width"])),
    escapeSql(gd?.thicknessMm ?? dim(part, ["thickness", "gpu_height_thickness"])),
    escapeSql(spec(part, ["pcie_bracket"])),
    escapeSql(dim(part, ["boost_clock_mhz", "boost_clock"])),
    escapeSql(dim(part, ["memory_speed_gbps", "memory_speed"])),
    escapeSql(gpuPart?.tdpW ?? dim(part, ["tdp_w", "tdp", "tdp_watt"])),
    escapeSql(gpuPart?.pciePins ?? spec(part, ["pcie_pins"])),
    escapeSql(dim(part, ["fan_count"])),
    escapeSql(dim(part, ["displayport_count", "displayport"])),
    escapeSql(dim(part, ["hdmi_count", "hdmi"])),
    escapeSql(dim(part, ["usb_c_count", "usb_c"])),
    bool(spec(part, ["dvi_d"]) === "Y" || part.flags.includes("dvi_d")),
    bool(gpuPart?.watercooled ?? false),
    bool(gpuPart?.lowProfile ?? false),
    bool(spec(part, ["blower"]) === "Y" || part.flags.includes("blower")),
    escapeSql(spec(part, ["remarks"])),
    escapeSql(part.status ?? ""),
    "current_timestamp",
    "current_timestamp"
  ].join(", ")});`;
}

export function cpuCoolerInsert(runId: string, slug: string, part: GenericPart) {
  return `insert into cpu_coolers (${[
    "id",
    "brand",
    "name",
    "type",
    "length_mm",
    "width_mm",
    "height_mm",
    "weight_g",
    "heatsink_material",
    "heatpipes",
    "ram_clearance_mm",
    "block_length_mm",
    "block_width_mm",
    "block_height_mm",
    "pump_speed_rpm",
    "pump_location",
    "tube_length_mm",
    "fan_thickness_mm",
    "total_thickness_mm",
    "tdp_w",
    "material",
    "fan_count",
    "fan_size_mm",
    "fan_speed_rpm",
    "airflow_cfm",
    "static_pressure_mmh2o",
    "noise_dba",
    "rgb_12v",
    "argb_5v",
    "usb_2_0_header",
    "pcie_sata_power",
    "socket_amd_fm",
    "socket_amd_am4_am5",
    "socket_intel_775",
    "socket_intel_115x_1200",
    "socket_intel_1366",
    "socket_intel_1700_1851",
    "socket_intel_2011_2066",
    "review_by_aris",
    "remarks",
    "status",
    "created_at",
    "updated_at"
  ].join(", ")}) values (${[
    escapeSql(slug),
    escapeSql(part.brand),
    escapeSql(part.name),
    escapeSql(spec(part, ["cooler_type", "type"])),
    escapeSql(dim(part, ["case_length", "length", "size_height"])),
    escapeSql(dim(part, ["case_width", "width", "size_width"])),
    escapeSql(dim(part, ["case_height", "height"])),
    escapeSql(dim(part, ["weight_g", "weight"])),
    escapeSql(spec(part, ["heatsink_material"])),
    escapeSql(dim(part, ["heatpipes", "heatpipe_count"])),
    escapeSql(dim(part, ["ram_clearance_mm", "ram_clearance"])),
    escapeSql(dim(part, ["block_length_mm", "block_length"])),
    escapeSql(dim(part, ["block_width_mm", "block_width"])),
    escapeSql(dim(part, ["block_height_mm", "block_height"])),
    escapeSql(dim(part, ["pump_speed_rpm", "pump_speed"])),
    escapeSql(spec(part, ["pump_location"])),
    escapeSql(dim(part, ["tube_length_mm", "tube_length"])),
    escapeSql(dim(part, ["fan_thickness_mm", "fan_thickness"])),
    escapeSql(dim(part, ["total_thickness_mm", "total_thickness"])),
    escapeSql(dim(part, ["tdp_w", "tdp", "tdp_watt"])),
    escapeSql(spec(part, ["material"])),
    escapeSql(dim(part, ["fan_count"])),
    escapeSql(dim(part, ["fan_size_mm", "fan_size", "size"])),
    escapeSql(dim(part, ["fan_speed_rpm", "fan_speed"])),
    escapeSql(dim(part, ["airflow_cfm", "airflow"])),
    escapeSql(dim(part, ["static_pressure_mmh2o", "static_pressure"])),
    escapeSql(dim(part, ["noise_dba", "noise"])),
    bool(spec(part, ["rgb_12v"]) === "Y" || part.flags.includes("rgb_12v")),
    bool(spec(part, ["argb_5v"]) === "Y" || part.flags.includes("argb_5v")),
    bool(spec(part, ["usb_2_0_header"]) === "Y" || part.flags.includes("usb_2_0_header")),
    escapeSql(spec(part, ["pcie_sata_power"])),
    bool(spec(part, ["socket_amd_fm", "amd_fm"]) === "Y"),
    bool(spec(part, ["socket_amd_am4_am5", "amd_am4_am5", "am4"]) === "Y"),
    bool(spec(part, ["socket_intel_775", "intel_775"]) === "Y"),
    bool(spec(part, ["socket_intel_115x_1200", "intel_115x_1200", "115x"]) === "Y"),
    bool(spec(part, ["socket_intel_1366", "intel_1366"]) === "Y"),
    bool(spec(part, ["socket_intel_1700_1851", "intel_1700_1851", "1700"]) === "Y"),
    bool(spec(part, ["socket_intel_2011_2066", "intel_2011_2066"]) === "Y"),
    escapeSql(spec(part, ["review_by_aris"])),
    escapeSql(spec(part, ["remarks"])),
    escapeSql(part.status ?? ""),
    "current_timestamp",
    "current_timestamp"
  ].join(", ")});`;
}

export function fanInsert(runId: string, slug: string, part: GenericPart) {
  return `insert into fans (${[
    "id",
    "brand",
    "model",
    "fan_size_mm",
    "thickness_mm",
    "max_speed_rpm",
    "max_airflow_cfm",
    "max_static_pressure_mmh2o",
    "max_noise_dba",
    "rated_current_a",
    "weight_g",
    "control_type",
    "voltage_v",
    "bearing",
    "fan_blades",
    "rgb_12v",
    "argb_5v",
    "cybenetics_phi_airflow",
    "cybenetics_phi_static_pressure",
    "cybenetics_report_url",
    "review_by_aris",
    "remarks",
    "status",
    "created_at",
    "updated_at"
  ].join(", ")}) values (${[
    escapeSql(slug),
    escapeSql(part.brand),
    escapeSql(spec(part, ["model", "name"])),
    escapeSql(dim(part, ["fan_size_mm", "fan_size", "size"])),
    escapeSql(dim(part, ["thickness_mm", "thickness", "fan_thickness"])),
    escapeSql(dim(part, ["max_speed_rpm", "speed_rpm", "fan_speed_rpm", "fan_speed"])),
    escapeSql(dim(part, ["max_airflow_cfm", "airflow_cfm", "airflow"])),
    escapeSql(dim(part, ["max_static_pressure_mmh2o", "static_pressure_mmh2o", "static_pressure"])),
    escapeSql(dim(part, ["max_noise_dba", "noise_dba", "noise"])),
    escapeSql(dim(part, ["rated_current_a", "rated_current"])),
    escapeSql(dim(part, ["weight_g", "weight"])),
    escapeSql(spec(part, ["control_type", "pwm"])),
    escapeSql(dim(part, ["voltage_v", "voltage"])),
    escapeSql(spec(part, ["bearing"])),
    escapeSql(dim(part, ["fan_blades", "blade_count"])),
    bool(spec(part, ["rgb_12v"]) === "Y" || part.flags.includes("rgb_12v")),
    bool(spec(part, ["argb_5v"]) === "Y" || part.flags.includes("argb_5v")),
    escapeSql(dim(part, ["cybenetics_phi_airflow", "phi_airflow"])),
    escapeSql(dim(part, ["cybenetics_phi_static_pressure", "phi_static_pressure"])),
    escapeSql(spec(part, ["cybenetics_report_url"])),
    escapeSql(spec(part, ["review_by_aris"])),
    escapeSql(spec(part, ["remarks"])),
    escapeSql(part.status ?? ""),
    "current_timestamp",
    "current_timestamp"
  ].join(", ")});`;
}

export function motherboardInsert(runId: string, slug: string, part: GenericPart) {
  return `insert into motherboards (${[
    "id",
    "cpu",
    "socket",
    "chipset",
    "brand",
    "name",
    "height_mm",
    "width_mm",
    "pcie_gen",
    "pci_slot_count",
    "pcie_x1_slot_count",
    "pcie_x4_slot_count",
    "pcie_x8_slot_count",
    "pcie_x16_slot_count",
    "pcie_x16_slot_position",
    "pcie_bifurcation",
    "cpu_overclock",
    "ram_overclock",
    "bios_flashback",
    "reset_cmos_button",
    "ram_slots",
    "ram_type",
    "ram_capacity_max_gb",
    "ram_speed_max_mbps",
    "sata_3_0_port_count",
    "m2_key_m_slot_count",
    "usb_a_2_0_ports",
    "usb_c_2_0_ports",
    "usb_a_3_2_gen1_ports",
    "usb_c_3_2_gen1_ports",
    "usb_a_3_2_gen2_ports",
    "usb_c_3_2_gen2_ports",
    "usb_c_3_2_gen2x2_ports",
    "usb4_ports",
    "thunderbolt_3_ports",
    "thunderbolt_4_ports",
    "total_usb_ports",
    "usb_2_0_header_count",
    "usb_3_2_gen1_header_count",
    "usb_c_header_count",
    "lan_port_count",
    "lan_controller",
    "lan_speed_gbps",
    "m2_key_e_wifi_bt",
    "wifi",
    "wifi_module",
    "wifi_speed_mbps",
    "bluetooth",
    "audio",
    "optical_spdif_out",
    "jack_3_5mm_count",
    "displayport_count",
    "hdmi_count",
    "dvi_count",
    "vga",
    "ps2_port",
    "fan_pump_header_count",
    "rgb_12v_header_count",
    "argb_5v_header_count",
    "temp_sensor_header",
    "debug_led",
    "status",
    "created_at",
    "updated_at"
  ].join(", ")}) values (${[
    escapeSql(slug),
    escapeSql(spec(part, ["cpu"])),
    escapeSql(spec(part, ["socket"])),
    escapeSql(spec(part, ["chipset"])),
    escapeSql(part.brand),
    escapeSql(part.name),
    escapeSql(dim(part, ["height_mm", "height"])),
    escapeSql(dim(part, ["width_mm", "width"])),
    escapeSql(spec(part, ["pcie_gen"])),
    escapeSql(dim(part, ["pci_slot_count", "pci_slots"])),
    escapeSql(dim(part, ["pcie_x1_slot_count", "pcie_x1"])),
    escapeSql(dim(part, ["pcie_x4_slot_count", "pcie_x4"])),
    escapeSql(dim(part, ["pcie_x8_slot_count", "pcie_x8"])),
    escapeSql(dim(part, ["pcie_x16_slot_count", "pcie_x16"])),
    escapeSql(spec(part, ["pcie_x16_slot_position"])),
    escapeSql(spec(part, ["pcie_bifurcation"])),
    bool(spec(part, ["cpu_overclock"]) === "Y"),
    bool(spec(part, ["ram_overclock"]) === "Y"),
    bool(spec(part, ["bios_flashback"]) === "Y"),
    bool(spec(part, ["reset_cmos_button"]) === "Y"),
    escapeSql(dim(part, ["ram_slots"])),
    escapeSql(spec(part, ["ram_type"])),
    escapeSql(dim(part, ["ram_capacity_max_gb", "ram_capacity"])),
    escapeSql(dim(part, ["ram_speed_max_mbps", "ram_speed"])),
    escapeSql(dim(part, ["sata_3_0_port_count", "sata_count", "sata"])),
    escapeSql(dim(part, ["m2_key_m_slot_count", "m2_slots", "m2"])),
    escapeSql(dim(part, ["usb_a_2_0_ports"])),
    escapeSql(dim(part, ["usb_c_2_0_ports"])),
    escapeSql(dim(part, ["usb_a_3_2_gen1_ports"])),
    escapeSql(dim(part, ["usb_c_3_2_gen1_ports"])),
    escapeSql(dim(part, ["usb_a_3_2_gen2_ports"])),
    escapeSql(dim(part, ["usb_c_3_2_gen2_ports"])),
    escapeSql(dim(part, ["usb_c_3_2_gen2x2_ports"])),
    escapeSql(dim(part, ["usb4_ports", "usb4"])),
    escapeSql(dim(part, ["thunderbolt_3_ports", "thunderbolt_3"])),
    escapeSql(dim(part, ["thunderbolt_4_ports", "thunderbolt_4"])),
    escapeSql(dim(part, ["total_usb_ports"])),
    escapeSql(dim(part, ["usb_2_0_header_count"])),
    escapeSql(dim(part, ["usb_3_2_gen1_header_count"])),
    escapeSql(dim(part, ["usb_c_header_count"])),
    escapeSql(dim(part, ["lan_port_count", "lan_ports"])),
    escapeSql(spec(part, ["lan_controller"])),
    escapeSql(dim(part, ["lan_speed_gbps", "lan_speed"])),
    bool(spec(part, ["m2_key_e_wifi_bt"]) === "Y"),
    escapeSql(spec(part, ["wifi"])),
    escapeSql(spec(part, ["wifi_module"])),
    escapeSql(dim(part, ["wifi_speed_mbps", "wifi_speed"])),
    escapeSql(spec(part, ["bluetooth"])),
    escapeSql(spec(part, ["audio"])),
    bool(spec(part, ["optical_spdif_out"]) === "Y"),
    escapeSql(dim(part, ["jack_3_5mm_count", "jack_count"])),
    escapeSql(dim(part, ["displayport_count", "displayport"])),
    escapeSql(dim(part, ["hdmi_count", "hdmi"])),
    escapeSql(dim(part, ["dvi_count", "dvi"])),
    bool(spec(part, ["vga"]) === "Y"),
    bool(spec(part, ["ps2_port"]) === "Y"),
    escapeSql(dim(part, ["fan_pump_header_count", "fan_headers"])),
    escapeSql(dim(part, ["rgb_12v_header_count"])),
    escapeSql(dim(part, ["argb_5v_header_count"])),
    bool(spec(part, ["temp_sensor_header"]) === "Y"),
    bool(spec(part, ["debug_led"]) === "Y"),
    escapeSql(part.status ?? ""),
    "current_timestamp",
    "current_timestamp"
  ].join(", ")});`;
}

export function psuInsert(
  runId: string,
  slug: string,
  part: GenericPart,
  tierIndex: Map<string, IntakeResult["psuTierEntries"][number] | null>
) {
  return `insert into psus (${[
    "id",
    "brand",
    "name",
    "form_factor",
    "wattage",
    "ac_input_voltage_v",
    "atx_3_compatible",
    "efficiency_80plus",
    "efficiency_80plus_report",
    "cybenetics_eta_115v",
    "cybenetics_eta_230v",
    "cybenetics_lambda_115v",
    "cybenetics_lambda_230v",
    "cybenetics_report_url",
    "modular",
    "semi_passive",
    "fan_start_load_pct",
    "fan_size_mm",
    "atx_bracket",
    "cable_24pin_atx_count",
    "cable_8pin_eps_count",
    "cable_pcie_6_2_count",
    "cable_12vhpwr_count",
    "cable_sata_count",
    "cable_peripheral_count",
    "oem",
    "warranty_years",
    "remarks",
    "review_by_aris",
    "status",
    "created_at",
    "updated_at"
  ].join(", ")}) values (${[
    escapeSql(slug),
    escapeSql(part.brand),
    escapeSql(part.name),
    escapeSql(spec(part, ["form_factor", "psu"])),
    escapeSql(dim(part, ["wattage", "watt", "watts"])),
    escapeSql(dim(part, ["ac_input_voltage_v", "ac_input_voltage"])),
    bool(spec(part, ["atx_3_compatible"]) === "Y"),
    escapeSql(spec(part, ["efficiency_80plus", "efficiency"])),
    escapeSql(spec(part, ["efficiency_80plus_report"])),
    escapeSql(spec(part, ["cybenetics_eta_115v", "eta_115v"])),
    escapeSql(spec(part, ["cybenetics_eta_230v", "eta_230v"])),
    escapeSql(spec(part, ["cybenetics_lambda_115v", "lambda_115v"])),
    escapeSql(spec(part, ["cybenetics_lambda_230v", "lambda_230v"])),
    escapeSql(spec(part, ["cybenetics_report_url"])),
    escapeSql(spec(part, ["modular"])),
    bool(spec(part, ["semi_passive"]) === "Y"),
    escapeSql(spec(part, ["fan_start_load_pct"])),
    escapeSql(dim(part, ["fan_size_mm", "fan_size"])),
    bool(spec(part, ["atx_bracket"]) === "Y"),
    escapeSql(dim(part, ["cable_24pin_atx_count", "cable_24pin", "count_24pin"])),
    escapeSql(dim(part, ["cable_8pin_eps_count", "cable_8pin_eps", "count_8pin_eps"])),
    escapeSql(dim(part, ["cable_pcie_6_2_count", "cable_pcie_6_2", "count_pcie_6_2"])),
    escapeSql(dim(part, ["cable_12vhpwr_count", "cable_12vhpwr", "count_12vhpwr"])),
    escapeSql(dim(part, ["cable_sata_count", "cable_sata", "count_sata"])),
    escapeSql(dim(part, ["cable_peripheral_count", "cable_peripheral", "count_peripheral"])),
    escapeSql(spec(part, ["oem"])),
    escapeSql(dim(part, ["warranty_years", "warranty"])),
    escapeSql(spec(part, ["remarks"])),
    escapeSql(spec(part, ["review_by_aris"])),
    escapeSql(part.status ?? ""),
    "current_timestamp",
    "current_timestamp"
  ].join(", ")});`;
}

export function ramInsert(runId: string, slug: string, part: GenericPart) {
  return `insert into ram (${[
    "id",
    "brand",
    "model",
    "memory_type",
    "height_mm",
    "rgb",
    "status",
    "created_at",
    "updated_at"
  ].join(", ")}) values (${[
    escapeSql(slug),
    escapeSql(part.brand),
    escapeSql(spec(part, ["model", "name"])),
    escapeSql(spec(part, ["memory_type", "type", "ddr_type"])),
    escapeSql(dim(part, ["height_mm", "height", "height_incl_contact_pins"])),
    bool(spec(part, ["rgb"]) === "Y" || part.flags.includes("rgb")),
    escapeSql(part.status ?? ""),
    "current_timestamp",
    "current_timestamp"
  ].join(", ")});`;
}

// ---------------------------------------------------------------------------
// Seed SQL builder
// ---------------------------------------------------------------------------

export function buildSeedSql(result: IntakeResult) {
  const runId = `import-${result.generatedAt.replace(/[^0-9a-z]/gi, "-").toLowerCase()}`;
  const casesBySourceRow = new Map(result.cases.map((part) => [`${part.sourceSheet}:${part.rowNumber}`, part]));
  const gpusBySourceRow = new Map(result.gpus.map((part) => [`${part.sourceSheet}:${part.rowNumber}`, part]));
  const tierIndex = psuTierByMatchKey(result);

  // Global slug uniqueness tracking
  const allSlugs = new Set<string>();

  const lines = [
    // DELETE from all tables in reverse dependency order
    "delete from ram;",
    "delete from psus;",
    "delete from motherboards;",
    "delete from fans;",
    "delete from cpu_coolers;",
    "delete from gpus;",
    "delete from cases;",
    "delete from column_help;"
  ];

  // Process each part, route to correct table
  for (const part of result.parts) {
    const casePart = casesBySourceRow.get(`${part.sourceSheet}:${part.rowNumber}`);
    const gpuPart = gpusBySourceRow.get(`${part.sourceSheet}:${part.rowNumber}`);
    const slug = uniqueSlug(part.brand, part.name, allSlugs);

    switch (part.kind) {
      case "case":
        lines.push(caseInsert(runId, slug, part, casePart));
        break;
      case "gpu":
        lines.push(gpuInsert(runId, slug, part, gpuPart));
        break;
      case "cpu-cooler":
        lines.push(cpuCoolerInsert(runId, slug, part));
        break;
      case "fan":
        lines.push(fanInsert(runId, slug, part));
        break;
      case "motherboard":
        lines.push(motherboardInsert(runId, slug, part));
        break;
      case "psu":
        lines.push(psuInsert(runId, slug, part, tierIndex));
        break;
      case "ram":
        lines.push(ramInsert(runId, slug, part));
        break;
      default:
        // Skip unknown kinds (reference, riser, etc.)
        break;
    }
  }

  return lines.join("\n");
}
