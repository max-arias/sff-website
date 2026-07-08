Status: resolved

## Answer

### Source sheet column maps for all 7 tables

---

### 1. `gpus` — from SFF GPU <215mm + GPU >215mm

Both tabs share 18 columns. One difference each:

| # | Source Header (shared) | DB Column | SQL Type |
|---|------------------------|-----------|----------|
| 1 | GPU | `chipset` | `text` |
| 2 | Model | `model` | `text` |
| 3 | Brand | `brand` | `text` |
| 4 | Name | `name` | `text` |
| 5 | Length (mm) | `length_mm` | `real` |
| 6 | Width (mm) | `width_mm` | `real` |
| 7 | Thickness (mm) | `thickness_mm` | `real` |
| 8 | PCIe Bracket | `pcie_bracket` | `text` |
| 9 | Boost Clock (MHz) | `boost_clock_mhz` | `integer` |
| 10 | Memory Speed (Gbps) | `memory_speed_gbps` | `real` |
| 11 | TDP (W) | `tdp_w` | `integer` |
| 12 | PCIe Pins | `pcie_pins` | `text` |
| 13 | Fans | `fan_count` | `integer` |
| 14 | DisplayPort | `displayport_count` | `integer` |
| 15 | HDMI | `hdmi_count` | `integer` |
| 16 | USB-C | `usb_c_count` | `integer` |
| 17 | DVI-D | `dvi_d` | `boolean` |
| 18 | Watercooled | `watercooled` | `boolean` |
| 19 | Remarks | `remarks` | `text` |

**Tab-specific columns:**
| # | Header | Tab | DB Column | SQL Type |
|---|--------|-----|-----------|----------|
| 20 | Low Profile | <215mm only | `low_profile` | `boolean` |
| 21 | Blower | >215mm only | `blower` | `boolean` |

Unified: **21 columns**. Low Profile and Blower are semantically distinct — both included, nullable when the source tab doesn't provide them.

---

### 2. `cpu_coolers` — from CPU Cooler <70mm + CPU Cooler >70mm + AIO

**Shared columns (both air tabs):**
- <70mm: 28 columns (Brand, Cooler, Type, dimensions, weight, material, heatpipes, RAM clearance, fans, fan details, socket compat, RGB, review, remarks) — missing TDP
- >70mm: 29 columns — same + TDP (W)

**AIO is substantially different** (33 columns) with radiator-specific fields.

**Unified column set** (all columns from all 3 tabs):

| # | Source Header | DB Column | SQL Type | Present In |
|---|---------------|-----------|----------|------------|
| 1 | Brand | `brand` | `text` | All |
| 2 | Cooler / Model | `name` | `text` | All |
| 3 | Type / Radiator Type | `type` | `text` | All |
| 4 | Length (mm) / Radiator Length | `length_mm` | `real` | All |
| 5 | Width (mm) / Radiator Width | `width_mm` | `real` | All |
| 6 | Height (mm) / Radiator Thickness | `height_mm` | `real` | All |
| 7 | Weight (g) | `weight_g` | `integer` | Air only |
| 8 | Heatsink Material / Radiator Material | `material` | `text` | All |
| 9 | Heatpipes | `heatpipes` | `integer` | Air only |
| 10 | TDP (W) | `tdp_w` | `integer` | >70mm only |
| 11 | RAM Clearance (mm) | `ram_clearance_mm` | `real` | Air only |
| 12 | Fans | `fan_count` | `integer` | All |
| 13 | Fan Size (mm) | `fan_size_mm` | `integer` | All |
| 14 | Fan Thickness (mm) | `fan_thickness_mm` | `integer` | AIO only |
| 15 | Max Fan Speed (RPM) | `fan_speed_rpm` | `integer` | All |
| 16 | Max Air Flow (CFM) / Fan Airflow | `airflow_cfm` | `real` | All |
| 17 | Max Static Pressure (mmH2O) | `static_pressure_mmh2o` | `real` | All |
| 18 | Max Noise (dB(A)) / Fan Noise | `noise_dba` | `real` | All |
| — | CPU Block Length (mm) | `block_length_mm` | `real` | AIO only |
| — | CPU Block Width (mm) | `block_width_mm` | `real` | AIO only |
| — | CPU Block Height (mm) | `block_height_mm` | `real` | AIO only |
| — | Pump Speed (rpm) | `pump_speed_rpm` | `integer` | AIO only |
| — | Pump Location | `pump_location` | `text` | AIO only |
| — | Tube length (mm) | `tube_length_mm` | `integer` | AIO only |
| — | Rad+Fan Total Thickness (mm) | `total_thickness_mm` | `real` | AIO only |
| — | 12V RGB LED Connection | `rgb_12v` | `boolean` | AIO only |
| — | 5V ARGB LED Connection | `argb_5v` | `boolean` | AIO only |
| — | USB 2.0 Header | `usb_2_0_header` | `boolean` | AIO only |
| — | PCIe/SATA Power | `pcie_sata_power` | `text` | AIO only |
| 19 | 12V RGB | `rgb_12v` | `boolean` | Air only |
| 20 | 5V ARGB | `argb_5v` | `boolean` | Air only |

**Socket compatibility** (boolean per socket, shared across all 3 tabs):
- `socket_amd_fm` (AMD FM1/FM2/AM1/AM2/AM3)
- `socket_amd_am4_am5`
- `socket_intel_775`
- `socket_intel_115x_1200`
- `socket_intel_1366`
- `socket_intel_1700_1851`
- `socket_intel_2011_2066`

Plus: `review_by_aris` (`text`) — all tabs. `remarks` (`text`) — air tabs only.

**Total unified: ~42 columns** — heavily sparse for air coolers (AIO-only fields null) and AIOs (air-only fields null).

---

### 3. `fans` — from Slim Fan + Fans

| # | Source Header | DB Column | SQL Type | Present In |
|---|---------------|-----------|----------|------------|
| 1 | Brand | `brand` | `text` | Both |
| 2 | Model | `model` | `text` | Both |
| 3 | Fan Size (mm) | `fan_size_mm` | `integer` | Both |
| 4 | Thickness (mm) | `thickness_mm` | `real` | Both |
| 5 | Max Fan Speed (rpm) | `max_speed_rpm` | `integer` | Both |
| 6 | Max Air Flow (CFM) | `max_airflow_cfm` | `real` | Both |
| 7 | Max Static Pressure (mmH2O) | `max_static_pressure_mmh2o` | `real` | Both |
| 8 | Max Noise (dB(A)) | `max_noise_dba` | `real` | Both |
| 9 | Rated Current (A) | `rated_current_a` | `real` | Both |
| 10 | Weight (g) | `weight_g` | `integer` | Both |
| 11 | PWM / DC | `control_type` | `text` | Both |
| 12 | Voltage (V) | `voltage_v` | `integer` | Both |
| 13 | Bearing | `bearing` | `text` | Both |
| 14 | Fan Blades | `fan_blades` | `integer` | Both |
| 15 | 12V RGB | `rgb_12v` | `boolean` | Both |
| 16 | 5V ARGB | `argb_5v` | `boolean` | Both |
| 17 | Cybenetics Test Report | `cybenetics_report_url` | `text` | Both |
| 18 | Remarks | `remarks` | `text` | Slim Fan only |
| 19 | Cybenetics Phi Airflow | `cybenetics_phi_airflow` | `real` | Fans only |
| 20 | Cybenetics Phi Static Pressure | `cybenetics_phi_static_pressure` | `real` | Fans only |
| 21 | Review by Aris | `review_by_aris` | `text` | Fans only |

Unified: **21 columns**.

---

### 4. `motherboards` — from mITX Boards + mATX Boards

These tabs have **substantial structural differences** (52 vs 49 columns). Many columns are shared, but each tab has unique columns reflecting form-factor-specific features.

**Tab-specific columns:**
- mITX only: USB-C 2.0 Ports, VGA, CPU/System Fan/Pump Header, 12V RGB LED Header, 5V ARGB LED Header, Temperature Sensor Header, Debug LED, Total USB Ports (broken out differently), 3.5mm Audio Jack, DVI-D/DVI-I
- mATX only: Size Height (mm), Size Width (mm), PCIe Gen, PCI Slot, PCIe x1/x4/x8 Slot, Main PCIe x16 Slot Position

**Unified column set:** ~60 columns. Both tabs' unique columns are included as nullable. The mITX 52 + mATX 49 share about 41 columns, with ~11+8 unique each.

Key columns (shared): CPU, Socket, Chipset, Brand, Name, PCIe x16 Slot (main), CPU Overclock, RAM Overclock, BIOS Flashback, RAM Slots, RAM Type, RAM Capacity, Memory Speed, SATA Ports, M.2 Slots, USB port counts (per generation), LAN, Wi-Fi, Bluetooth, Audio, Display outputs, various headers.

Full column list is large but follows the same pattern as other tables — typed columns, no JSON blobs. Full DDL deferred to a prototype ticket.

---

### 5. `psus` — from PSU (single tab, no merge)

| # | Source Header | DB Column | SQL Type |
|---|---------------|-----------|----------|
| 1 | Brand | `brand` | `text` |
| 2 | Name | `name` | `text` |
| 3 | Form Factor | `form_factor` | `text` |
| 4 | Wattage | `wattage` | `integer` |
| 5 | AC Input Voltage (V) | `ac_input_voltage_v` | `integer` |
| 6 | ATX 3.X/SFX 4.X Compatible | `atx_3_compatible` | `boolean` |
| 7 | 80 PLUS Rating | `efficiency_80plus` | `text` |
| 8 | 80 PLUS Test Report | `efficiency_80plus_report_url` | `text` |
| 9 | Cybenetics ETA 115V | `cybenetics_eta_115v` | `text` |
| 10 | Cybenetics ETA 230V | `cybenetics_eta_230v` | `text` |
| 11 | Cybenetics Lambda 115V | `cybenetics_lambda_115v` | `text` |
| 12 | Cybenetics Lambda 230V | `cybenetics_lambda_230v` | `text` |
| 13 | Cybenetics Test Report | `cybenetics_report_url` | `text` |
| 14 | Modular | `modular` | `text` |
| 15 | Semi Passive | `semi_passive` | `boolean` |
| 16 | PSU Fan Start (load) | `fan_start_load_pct` | `text` |
| 17 | Fan Size (mm) | `fan_size_mm` | `integer` |
| 18 | ATX Bracket | `atx_bracket` | `boolean` |
| — | Cable counts (6 pairs of cable+connector columns) | individual `_count` columns | `integer` |
| 19-24 | Cable types: 24-pin ATX, 8-pin EPS, PCIe 6+2, 12VHPWR, SATA, Peripheral | `cable_X_count` | `integer` |
| 25 | OEM | `oem` | `text` |
| 26 | Warranty (years) | `warranty_years` | `integer` |
| 27 | Remarks | `remarks` | `text` |
| 28 | Review by Aris | `review_by_aris` | `text` |

**Caveat:** Cable columns come in pairs (cable description + connector count). The DB stores only the connector counts as integers. ~33 columns total.

---

### 6. `ram` — from RAM Height (single tab, no merge)

| # | Source Header | DB Column | SQL Type |
|---|---------------|-----------|----------|
| 1 | Brand | `brand` | `text` |
| 2 | Model | `model` | `text` |
| 3 | Memory Type | `memory_type` | `text` |
| 4 | Height incl contact pins (mm) | `height_mm` | `real` |
| 5 | RGB | `rgb` | `boolean` |

**5 columns.** Smallest table.

---

### 7. `cases` — already resolved (ticket 01)

41 shared columns + radiator boolean expansions + drive raw columns. ~55 columns.

---

### Summary

| Table | Source Tabs | Shared Columns | Total Unified | Complexity |
|-------|-------------|----------------|---------------|------------|
| cases | 3 | 41/41 ✓ | ~55 | Low (identical tabs) |
| gpus | 2 | 18/19 | 21 | Low (1 column diff each) |
| cpu_coolers | 3 | varies widely | ~42 | High (AIO is very different) |
| fans | 2 | 17/20 | 21 | Low |
| motherboards | 2 | ~41/50+ | ~60 | High (form factor diffs) |
| psus | 1 | — | ~33 | None |
| ram | 1 | — | 5 | None |

Each table follows the same conventions: `id text` slug PK, `created_at`, `updated_at`, `status` on all but `ram` (no status in source). All columns typed, no JSON blobs. Motherboard and cpu_coolers tables will be heavily sparse due to form factor/type differences — this is acceptable and preferred over multiple tables per variant.

## Question

What are the column sets for the remaining source sheets? We need column lists for:

- **SFF GPU <215mm** and **GPU >215mm** → unified into `gpus` table
- **CPU Cooler >70mm** → merged with <70mm and AIO into `cpu_coolers` table  
- **Fans** (non-slim) → merged with Slim Fan into `fans` table
- **mITX Boards** and **mATX Boards** → merged into `motherboards` table
- **PSU** → `psus` table
- **RAM Height** → `ram` table

Column sets we already have: CPU Cooler <70mm, AIO, Slim Fan (HTMLs at `/mnt/c/Users/max/Downloads/SFF PC Master List/`).

If the full sheet data is accessible (Google Sheet URL or additional downloaded HTMLs/CSVs), extract column headers. If not, document exactly which sheets are missing and how to get them.

Type: research
