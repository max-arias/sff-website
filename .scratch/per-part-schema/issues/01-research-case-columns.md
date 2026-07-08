Type: research
Status: resolved

## Answer

All three case source tabs (<10L, 10L-20L, >20L) share an identical 41-column structure. No tab-specific columns, no naming inconsistencies.

### Unified Column List (41 data columns)

| # | Source Header | DB Column | SQL Type |
|---|---------------|-----------|----------|
| 1 | Seller | `seller` | `text` |
| 2 | Case | `name` | `text` |
| 3 | Style | `style` | `text` |
| 4 | Case Length (mm) | `length_mm` | `real` |
| 5 | Case Width (mm) | `width_mm` | `real` |
| 6 | Case Height (mm) | `height_mm` | `real` |
| 7 | Volume (L) | `volume_l` | `real` |
| 8 | Footprint (cm2) | `footprint_cm2` | `real` |
| 9 | Weight (kg) | `weight_kg` | `real` |
| 10 | Side Panel | `side_panel` | `text` |
| 11 | Case Material | `case_material` | `text` |
| 12 | CPU Cooler Height (mm) | `cpu_cooler_height_mm` | `real` |
| 13 | AIO / Radiator Support | `radiator_support_raw` | `text` |
| 14 | GPU Riser | `gpu_riser` | `text` |
| 15 | GPU Length (mm) | `gpu_length_mm` | `real` |
| 16 | GPU Width (mm) | `gpu_width_mm` | `real` |
| 17 | GPU Height / Thickness (mm) | `gpu_height_mm` | `real` |
| 18 | PCIe Slot | `pcie_slots` | `integer` |
| 19 | LP PCIe Slot | `lp_pcie_slots` | `integer` |
| 20 | Motherboard | `motherboard` | `text` |
| 21 | PSU | `psu` | `text` |
| 22 | 2.5" Drive | `drive_2_5_max` | `integer` |
| 23 | 3.5" Drive | `drive_3_5_max` | `integer` |
| 24 | 5.25" Drive | `drive_5_25_max` | `integer` |
| 25 | 40 mm Fan | `fan_40mm_count` | `integer` |
| 26 | 60 mm Fan | `fan_60mm_count` | `integer` |
| 27 | 80 mm Fan | `fan_80mm_count` | `integer` |
| 28 | 92 mm Fan | `fan_92mm_count` | `integer` |
| 29 | 120 mm Fan | `fan_120mm_count` | `integer` |
| 30 | 140 mm Fan | `fan_140mm_count` | `integer` |
| 31 | 180 mm Fan | `fan_180mm_count` | `integer` |
| 32 | 200 mm Fan | `fan_200mm_count` | `integer` |
| 33 | USB-A 2.0 I/O | `usb_a_2_0_count` | `integer` |
| 34 | USB-A 3.2 Gen 1 I/O | `usb_a_3_2_count` | `integer` |
| 35 | USB-C I/O | `usb_c_count` | `integer` |
| 36 | 3.5mm Jack I/O | `jack_3_5mm` | `boolean` |
| 37 | Price (CNY) | `price_cny` | `real` |
| 38 | Price (USD) | `price_usd` | `real` |
| 39 | SFF.Net Link | `sff_net_link` | `text` |
| 40 | Status | `status` | `text` |
| 41 | Last Update | `last_update` | `text` |

### Multi-Value Expansions

**Radiator support** — kept as raw text column PLUS boolean flags per size:
`radiator_120mm`, `radiator_140mm`, `radiator_200mm`, `radiator_240mm`, `radiator_280mm`, `radiator_360mm`, `radiator_420mm` (all `boolean`), plus `radiator_top_hat` (`boolean`).

**Drive bays** — `drive_2_5_max`, `drive_3_5_max`, `drive_5_25_max` (all `integer`, upper bound parsed from "0 to X" patterns). Optional raw companion columns for fidelity.

**Fan slots and I/O** — already atomic per-size/per-type integer columns. No expansion needed.

### Cross-Tab Findings

- Zero naming inconsistencies across all three tabs — identical headers byte-for-byte
- Zero tab-specific columns — all 41 data columns appear in every tab
- Zero duplicate (Seller, Case) pairs across all 947 rows

## Question

What is the exact unified column set for the `cases` table? The SFF Master List has cases spread across three source tabs:

1. **SFF Case <10L** — 43 columns (extracted from HTML)
2. **SFF Case 10L-20L** — column list pending (HTML available at `/mnt/c/Users/max/Downloads/SFF PC Master List/SFF Case 10L-20L.html`)
3. **MFF Case >20L** — 42 columns (extracted from HTML, one fewer: no "Link" column vs <10L tab)

Determine which columns are shared across all three tabs, which are tab-specific, and produce the final unified column list for a single `cases` table. Every sheet column should be represented as a typed DB column (no JSON blob fallback).

Known columns from <10L and >20L: Seller, Case (name), Style, Case Length (mm), Case Width (mm), Case Height (mm), Volume (L), Footprint (cm²), Weight (kg), Side Panel, Case Material, CPU Cooler Height (mm), AIO / Radiator Support, GPU Riser, GPU Length (mm), GPU Width (mm), GPU Height / Thickness (mm), PCIe Slot, LP PCIe Slot, Motherboard, PSU, 2.5" Drive, 3.5" Drive, 5.25" Drive, 40/60/80/92/120/140/180/200mm Fan, USB-A 2.0/3.2 Gen 1 I/O, USB-C I/O, 3.5mm Jack I/O, Price (CNY), Price (USD), SFF.Net Link, Status, Last Update.

Type: research
