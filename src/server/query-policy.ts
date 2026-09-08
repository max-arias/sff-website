import type { SelectableKind } from "../types";
import { NUMERIC_FILTER_PARAM_NAMES } from "../lib/build-filter-params";

export type NumericFilterName =
  | "case-max-volume-l" | "case-max-length-mm" | "case-max-width-mm" | "case-max-height-mm" | "case-max-weight-kg" | "case-max-footprint-cm2" | "case-max-gpu-length-mm" | "case-max-gpu-width-mm" | "case-max-gpu-thickness-mm" | "case-max-pcie-slots" | "case-max-lp-pcie-slots" | "case-max-cpu-cooler-height-mm" | "case-max-drive-25" | "case-max-drive-35" | "case-max-drive-525" | "case-max-fan-40" | "case-max-fan-60" | "case-max-fan-80" | "case-max-fan-92" | "case-max-fan-120" | "case-max-fan-140" | "case-max-fan-180" | "case-max-fan-200" | "case-max-usb-a20" | "case-max-usb-a32" | "case-max-usb-c" | "case-max-cny" | "case-max-usd"
  | "max-gpu-length-mm" | "max-gpu-width-mm" | "max-gpu-thickness-mm" | "max-gpu-slots" | "max-gpu-boost-clock-mhz" | "max-gpu-memory-speed-gbps" | "max-gpu-tdp-w" | "max-gpu-fan-count" | "max-gpu-displayport-count" | "max-gpu-hdmi-count" | "max-gpu-usb-c-count"
  | "cooler-max-length-mm" | "cooler-max-width-mm" | "cooler-max-height-mm" | "cooler-max-weight-g" | "cooler-max-heatpipes" | "cooler-max-block-length-mm" | "cooler-max-block-width-mm" | "cooler-max-block-height-mm" | "cooler-max-pump-speed-rpm" | "cooler-max-tube-length-mm" | "cooler-max-fan-thickness-mm" | "cooler-max-total-thickness-mm" | "cooler-max-tdp-w" | "cooler-max-fan-size-mm" | "cooler-max-fan-count" | "cooler-max-fan-speed-rpm" | "cooler-max-airflow-cfm" | "cooler-max-static-pressure-mmh2o" | "cooler-max-noise-dba" | "cooler-max-ram-clearance-mm"
  | "psu-max-wattage" | "psu-max-ac-input-v" | "psu-max-fan-size-mm" | "psu-max-cable-24pin" | "psu-max-cable-8pin-eps" | "psu-max-cable-pcie-62" | "psu-max-cable-sata" | "psu-max-cable-peripheral" | "psu-max-warranty-years"
  | "mobo-max-height-mm" | "mobo-max-width-mm" | "mobo-max-pci-slots" | "mobo-max-pcie-x1" | "mobo-max-pcie-x4" | "mobo-max-pcie-x8" | "mobo-max-pcie-x16-count" | "mobo-max-ram-slots" | "mobo-max-ram-capacity-gb" | "mobo-max-ram-speed-mbps" | "mobo-max-m2-count" | "mobo-max-sata-count" | "mobo-max-usb-ports" | "mobo-max-usb-a20" | "mobo-max-usb-c20" | "mobo-max-usb-a32g1" | "mobo-max-usb-c32g1" | "mobo-max-usb-a32g2" | "mobo-max-usb-c32g2" | "mobo-max-usb-c32g2x2" | "mobo-max-usb4" | "mobo-max-tb3" | "mobo-max-tb4" | "mobo-max-usb2-header" | "mobo-max-usb32g1-header" | "mobo-max-usbc-header" | "mobo-max-lan-ports" | "mobo-max-lan-speed-gbps" | "mobo-max-wifi-speed-mbps" | "mobo-max-jack-35" | "mobo-max-dp" | "mobo-max-hdmi" | "mobo-max-dvi" | "mobo-max-fan-pump-headers" | "mobo-max-rgb-header" | "mobo-max-argb-header"
  | "ram-max-height-mm";

// Keep this registry coupled to the accepted build numeric-filter list. If a
// URL filter is added there without a query-policy name, typechecking fails.
type UnmappedBuildNumericFilter = Exclude<
  (typeof NUMERIC_FILTER_PARAM_NAMES)[number],
  NumericFilterName
>;
export const NUMERIC_FILTER_POLICY_COVERAGE: UnmappedBuildNumericFilter extends never
  ? true
  : never = true;

type NumericColumns = Partial<Record<NumericFilterName, string>>;

const CASE_NUMERIC: NumericColumns = {
  "case-max-volume-l": "volume_l", "case-max-length-mm": "length_mm", "case-max-width-mm": "width_mm", "case-max-height-mm": "height_mm", "case-max-weight-kg": "weight_kg", "case-max-footprint-cm2": "footprint_cm2", "case-max-gpu-length-mm": "gpu_length_mm", "case-max-gpu-width-mm": "gpu_width_mm", "case-max-gpu-thickness-mm": "gpu_height_mm", "case-max-pcie-slots": "pcie_slots", "case-max-lp-pcie-slots": "lp_pcie_slots", "case-max-cpu-cooler-height-mm": "cpu_cooler_height_mm", "case-max-drive-25": "drive_2_5_max", "case-max-drive-35": "drive_3_5_max", "case-max-drive-525": "drive_5_25_max", "case-max-fan-40": "fan_40mm_count", "case-max-fan-60": "fan_60mm_count", "case-max-fan-80": "fan_80mm_count", "case-max-fan-92": "fan_92mm_count", "case-max-fan-120": "fan_120mm_count", "case-max-fan-140": "fan_140mm_count", "case-max-fan-180": "fan_180mm_count", "case-max-fan-200": "fan_200mm_count", "case-max-usb-a20": "usb_a_2_0_count", "case-max-usb-a32": "usb_a_3_2_count", "case-max-usb-c": "usb_c_count", "case-max-cny": "price_cny", "case-max-usd": "price_usd",
} satisfies Record<Extract<NumericFilterName, `case-${string}`>, string>;

const GPU_NUMERIC: NumericColumns = {
  "max-gpu-length-mm": "length_mm", "max-gpu-width-mm": "width_mm", "max-gpu-thickness-mm": "thickness_mm", "max-gpu-slots": "pcie_bracket", "max-gpu-boost-clock-mhz": "boost_clock_mhz", "max-gpu-memory-speed-gbps": "memory_speed_gbps", "max-gpu-tdp-w": "tdp_w", "max-gpu-fan-count": "fan_count", "max-gpu-displayport-count": "displayport_count", "max-gpu-hdmi-count": "hdmi_count", "max-gpu-usb-c-count": "usb_c_count",
} satisfies Record<Extract<NumericFilterName, `max-gpu-${string}`>, string>;

const COOLER_NUMERIC: NumericColumns = {
  "cooler-max-length-mm": "length_mm", "cooler-max-width-mm": "width_mm", "cooler-max-height-mm": "height_mm", "cooler-max-weight-g": "weight_g", "cooler-max-heatpipes": "heatpipes", "cooler-max-block-length-mm": "block_length_mm", "cooler-max-block-width-mm": "block_width_mm", "cooler-max-block-height-mm": "block_height_mm", "cooler-max-pump-speed-rpm": "pump_speed_rpm", "cooler-max-tube-length-mm": "tube_length_mm", "cooler-max-fan-thickness-mm": "fan_thickness_mm", "cooler-max-total-thickness-mm": "total_thickness_mm", "cooler-max-tdp-w": "tdp_w", "cooler-max-fan-size-mm": "fan_size_mm", "cooler-max-fan-count": "fan_count", "cooler-max-fan-speed-rpm": "fan_speed_rpm", "cooler-max-airflow-cfm": "airflow_cfm", "cooler-max-static-pressure-mmh2o": "static_pressure_mmh2o", "cooler-max-noise-dba": "noise_dba", "cooler-max-ram-clearance-mm": "ram_clearance_mm",
} satisfies Record<Extract<NumericFilterName, `cooler-${string}`>, string>;

const PSU_NUMERIC: NumericColumns = {
  "psu-max-wattage": "wattage", "psu-max-ac-input-v": "ac_input_voltage_v", "psu-max-fan-size-mm": "fan_size_mm", "psu-max-cable-24pin": "cable_24pin_atx_count", "psu-max-cable-8pin-eps": "cable_8pin_eps_count", "psu-max-cable-pcie-62": "cable_pcie_6_2_count", "psu-max-cable-sata": "cable_sata_count", "psu-max-cable-peripheral": "cable_peripheral_count", "psu-max-warranty-years": "warranty_years",
} satisfies Record<Extract<NumericFilterName, `psu-${string}`>, string>;

const MOTHERBOARD_NUMERIC: NumericColumns = {
  "mobo-max-height-mm": "height_mm", "mobo-max-width-mm": "width_mm", "mobo-max-pci-slots": "pci_slot_count", "mobo-max-pcie-x1": "pcie_x1_slot_count", "mobo-max-pcie-x4": "pcie_x4_slot_count", "mobo-max-pcie-x8": "pcie_x8_slot_count", "mobo-max-pcie-x16-count": "pcie_x16_slot_count", "mobo-max-ram-slots": "ram_slots", "mobo-max-ram-capacity-gb": "ram_capacity_max_gb", "mobo-max-ram-speed-mbps": "ram_speed_max_mbps", "mobo-max-m2-count": "m2_key_m_slot_count", "mobo-max-sata-count": "sata_3_0_port_count", "mobo-max-usb-ports": "total_usb_ports", "mobo-max-usb-a20": "usb_a_2_0_ports", "mobo-max-usb-c20": "usb_c_2_0_ports", "mobo-max-usb-a32g1": "usb_a_3_2_gen1_ports", "mobo-max-usb-c32g1": "usb_c_3_2_gen1_ports", "mobo-max-usb-a32g2": "usb_a_3_2_gen2_ports", "mobo-max-usb-c32g2": "usb_c_3_2_gen2_ports", "mobo-max-usb-c32g2x2": "usb_c_3_2_gen2x2_ports", "mobo-max-usb4": "usb4_ports", "mobo-max-tb3": "thunderbolt_3_ports", "mobo-max-tb4": "thunderbolt_4_ports", "mobo-max-usb2-header": "usb_2_0_header_count", "mobo-max-usb32g1-header": "usb_3_2_gen1_header_count", "mobo-max-usbc-header": "usb_c_header_count", "mobo-max-lan-ports": "lan_port_count", "mobo-max-lan-speed-gbps": "lan_speed_gbps", "mobo-max-wifi-speed-mbps": "wifi_speed_mbps", "mobo-max-jack-35": "jack_3_5mm_count", "mobo-max-dp": "displayport_count", "mobo-max-hdmi": "hdmi_count", "mobo-max-dvi": "dvi_count", "mobo-max-fan-pump-headers": "fan_pump_header_count", "mobo-max-rgb-header": "rgb_12v_header_count", "mobo-max-argb-header": "argb_5v_header_count",
} satisfies Record<Extract<NumericFilterName, `mobo-${string}`>, string>;

const RAM_NUMERIC = { "ram-max-height-mm": "height_mm" } satisfies Record<Extract<NumericFilterName, `ram-${string}`>, string>;

export const NUMERIC_COLUMNS_BY_KIND = {
  case: CASE_NUMERIC, gpu: GPU_NUMERIC, "cpu-cooler": COOLER_NUMERIC,
  motherboard: MOTHERBOARD_NUMERIC, psu: PSU_NUMERIC, ram: RAM_NUMERIC,
} as const satisfies Record<SelectableKind, NumericColumns>;

export type SemanticSort = "name" | "release-year" | "volume" | "length" | "width" | "height" | "thickness" | "price" | "wattage" | "tier" | "form-factor";
export const SORT_COLUMNS_BY_KIND: Record<SelectableKind, Partial<Record<SemanticSort, string>>> = {
  case: { name: "name", "release-year": "release_year", volume: "volume_l", length: "length_mm", width: "width_mm", height: "height_mm" },
  gpu: { name: "name", "release-year": "release_year", length: "length_mm", width: "width_mm", thickness: "thickness_mm" },
  "cpu-cooler": { name: "name", "release-year": "release_year", length: "length_mm", width: "width_mm", height: "height_mm" },
  motherboard: { name: "name", "release-year": "release_year", height: "height_mm", width: "width_mm" },
  psu: { name: "name", "release-year": "release_year", wattage: "wattage", tier: "psu_tier_rank", "form-factor": "form_factor" },
  ram: { name: "model", "release-year": "release_year", height: "height_mm" },
};

export function numericColumn(kind: SelectableKind, filter: string): string | undefined {
  return (NUMERIC_COLUMNS_BY_KIND[kind] as Partial<Record<string, string>>)[filter];
}

export const SPARSE_COLUMNS: Record<SelectableKind, readonly string[]> = {
  case: ["volume_l", "length_mm", "width_mm", "height_mm", "gpu_length_mm", "gpu_width_mm", "gpu_height_mm", "pcie_slots", "cpu_cooler_height_mm", "psu", "motherboard"],
  gpu: ["length_mm", "width_mm", "thickness_mm", "pcie_bracket", "tdp_w", "low_profile"],
  "cpu-cooler": ["length_mm", "width_mm", "height_mm", "ram_clearance_mm", "tdp_w"],
  motherboard: ["height_mm", "width_mm", "ram_type", "form_factor", "ram_slots"],
  psu: ["form_factor", "wattage", "psu_tier", "fan_size_mm"],
  ram: ["memory_type", "height_mm"],
};

export const TABLE_FOR_KIND: Record<SelectableKind, string> = {
  case: "cases", gpu: "gpus", "cpu-cooler": "cpu_coolers", motherboard: "motherboards", psu: "psus", ram: "ram",
};
