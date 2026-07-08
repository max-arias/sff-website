Type: prototype
Status: resolved

## Answer

### 1. `gpus` — 24 columns

```sql
create table if not exists gpus (
  id                        text primary key,
  brand                     text    not null default '',
  name                      text    not null default '',
  model                     text    not null default '',
  chipset                   text    not null default '',   -- 'RTX 4070', 'RX 7900 XT'
  length_mm                 real,
  width_mm                  real,
  thickness_mm              real,
  pcie_bracket              text    not null default '',   -- '2', '3', etc.
  boost_clock_mhz           integer,
  memory_speed_gbps         real,
  tdp_w                     integer,
  pcie_pins                 text    not null default '',
  fan_count                 integer,
  displayport_count         integer,
  hdmi_count                integer,
  usb_c_count               integer,
  dvi_d                     boolean not null default 0,
  watercooled               boolean not null default 0,
  low_profile               boolean not null default 0,    -- <215mm tab only
  blower                    boolean not null default 0,    -- >215mm tab only
  remarks                   text    not null default '',
  status                    text    not null default '',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);
```

### 2. `cpu_coolers` — 39 columns

```sql
create table if not exists cpu_coolers (
  id                        text primary key,
  brand                     text    not null default '',
  name                      text    not null default '',
  type                      text    not null default '',   -- 'Low Profile', 'Tower', 'AIO'
  length_mm                 real,
  width_mm                  real,
  height_mm                 real,                          -- heatsink height (air) or radiator thickness (AIO)
  weight_g                  integer,                       -- air only

  -- Air-cooler specific
  heatsink_material         text    not null default '',
  heatpipes                 integer,                       -- air only
  ram_clearance_mm          real,                          -- air only

  -- AIO specific
  block_length_mm           real,
  block_width_mm            real,
  block_height_mm           real,
  pump_speed_rpm            integer,
  pump_location             text    not null default '',
  tube_length_mm            integer,
  fan_thickness_mm          real,
  total_thickness_mm        real,                          -- rad + fan combined

  -- Performance (shared)
  tdp_w                     integer,                       -- >70mm and AIO only
  material                  text    not null default '',   -- heatsink or radiator material
  fan_count                 integer,
  fan_size_mm               integer,
  fan_speed_rpm             integer,
  airflow_cfm               real,
  static_pressure_mmh2o     real,
  noise_dba                 real,

  -- RGB & power
  rgb_12v                   boolean not null default 0,    -- unified from both air and AIO tabs
  argb_5v                   boolean not null default 0,    -- unified from both air and AIO tabs
  usb_2_0_header            boolean not null default 0,    -- AIO only
  pcie_sata_power           text    not null default '',   -- AIO only

  -- Socket compatibility (all boolean, shared)
  socket_amd_fm             boolean not null default 0,
  socket_amd_am4_am5        boolean not null default 0,
  socket_intel_775          boolean not null default 0,
  socket_intel_115x_1200    boolean not null default 0,
  socket_intel_1366         boolean not null default 0,
  socket_intel_1700_1851    boolean not null default 0,
  socket_intel_2011_2066    boolean not null default 0,

  review_by_aris            text    not null default '',
  remarks                   text    not null default '',   -- air only
  status                    text    not null default '',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);
```

**Merge notes:**
- `type` distinguishes air ('Low Profile', 'Tower') from AIO. The source columns `Type` (air) and `Radiator Type` (AIO) both map here.
- RGB columns unified — air tabs have '12V RGB'/'5V ARGB', AIO has '12V RGB LED Connection'/'5V ARGB LED Connection'. Same concept.
- `material` merges 'Heatsink Material' (air), 'Radiator Material' (AIO).
- `tdp_w` appears only in >70mm and AIO tabs. Nullable.
- AIO-only columns (block dimensions, pump, tube, fan thickness, total thickness, USB header, PCIe/SATA power) are null for air coolers.
- Air-only columns (weight, heatpipes, ram clearance, remarks) are null for AIOs.

### 3. `fans` — 24 columns

```sql
create table if not exists fans (
  id                        text primary key,
  brand                     text    not null default '',
  model                     text    not null default '',
  fan_size_mm               integer,
  thickness_mm              real,
  max_speed_rpm             integer,
  max_airflow_cfm           real,
  max_static_pressure_mmh2o real,
  max_noise_dba             real,
  rated_current_a           real,
  weight_g                  integer,
  control_type              text    not null default '',   -- 'PWM', 'DC'
  voltage_v                 integer,
  bearing                   text    not null default '',
  fan_blades                integer,
  rgb_12v                   boolean not null default 0,
  argb_5v                   boolean not null default 0,
  cybenetics_phi_airflow    real,                          -- Fans tab only
  cybenetics_phi_static_pressure real,                     -- Fans tab only
  cybenetics_report_url     text    not null default '',
  review_by_aris            text    not null default '',   -- Fans tab only
  remarks                   text    not null default '',   -- Slim Fan only
  status                    text    not null default '',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);
```

### 4. `motherboards` — 58 columns

```sql
create table if not exists motherboards (
  id                        text primary key,
  cpu                       text    not null default '',   -- 'AMD AM4', 'Intel 1700'
  socket                    text    not null default '',
  chipset                   text    not null default '',
  brand                     text    not null default '',
  name                      text    not null default '',

  -- Physical
  height_mm                 real,                          -- mATX only
  width_mm                  real,                          -- mATX only

  -- PCIe
  pcie_gen                  text    not null default '',   -- mATX only, '4.0', '5.0'
  pci_slot_count            integer,                       -- mATX only
  pcie_x1_slot_count        integer,                       -- mATX only
  pcie_x4_slot_count        integer,                       -- mATX only
  pcie_x8_slot_count        integer,                       -- mATX only
  pcie_x16_slot_count       integer,
  pcie_x16_slot_position    text    not null default '',   -- mATX only, slot position label
  pcie_bifurcation          text    not null default '',   -- mITX only

  -- Overclocking
  cpu_overclock             boolean not null default 0,
  ram_overclock             boolean not null default 0,
  bios_flashback            boolean not null default 0,
  reset_cmos_button         boolean not null default 0,

  -- RAM
  ram_slots                 integer,
  ram_type                  text    not null default '',   -- 'DDR4', 'DDR5'
  ram_capacity_max_gb       integer,
  ram_speed_max_mbps        integer,

  -- Storage
  sata_3_0_port_count       integer,
  m2_key_m_slot_count       integer,

  -- USB (rear I/O counts)
  usb_a_2_0_ports           integer,
  usb_c_2_0_ports           integer,                       -- mITX only
  usb_a_3_2_gen1_ports      integer,
  usb_c_3_2_gen1_ports      integer,
  usb_a_3_2_gen2_ports      integer,
  usb_c_3_2_gen2_ports      integer,
  usb_c_3_2_gen2x2_ports    integer,
  usb4_ports                integer,
  thunderbolt_3_ports       integer,
  thunderbolt_4_ports       integer,
  total_usb_ports           integer,

  -- USB headers
  usb_2_0_header_count      integer,
  usb_3_2_gen1_header_count integer,
  usb_c_header_count        integer,

  -- Networking
  lan_port_count            integer,
  lan_controller            text    not null default '',
  lan_speed_gbps            real,
  m2_key_e_wifi_bt          boolean not null default 0,
  wifi                      text    not null default '',
  wifi_module               text    not null default '',
  wifi_speed_mbps           integer,
  bluetooth                 text    not null default '',

  -- Audio
  audio                     text    not null default '',
  optical_spdif_out         boolean not null default 0,
  jack_3_5mm_count          integer,                       -- mITX only

  -- Display outputs
  displayport_count         integer,
  hdmi_count                integer,
  dvi_count                 integer,
  vga                       boolean not null default 0,    -- mITX only

  -- Other I/O
  ps2_port                  boolean not null default 0,

  -- Headers & features
  fan_pump_header_count     integer,                       -- mITX only
  rgb_12v_header_count      integer,                       -- mITX only
  argb_5v_header_count      integer,                       -- mITX only
  temp_sensor_header        boolean not null default 0,    -- mITX only
  debug_led                 boolean not null default 0,    -- mITX only

  status                    text    not null default '',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);
```

**Merge notes:**
- mITX has 52 columns, mATX has 49. Shared ~41. Total unified 58.
- Physical dimensions (`height_mm`, `width_mm`) are mATX-only — mATX boards aren't a fixed form factor like mITX.
- PCIe expansion slots (PCI, x1, x4, x8) and slot position are mATX-only.
- mITX adds bifurcation support, VGA, debug LED, fan/pump header counts, RGB header counts, and temp sensor — features that mATX boards typically don't report the same way.
- USB-C 2.0 ports, 3.5mm jack count, DVI count are mITX-only columns.
- `remarks` column absent from motherboard source sheets. No status or last_update from source either.

### 5. `psus` — 37 columns

```sql
create table if not exists psus (
  id                        text primary key,
  brand                     text    not null default '',
  name                      text    not null default '',
  form_factor               text    not null default '',   -- 'SFX', 'SFX-L', 'Flex ATX', 'ATX'
  wattage                   integer,
  ac_input_voltage_v        integer,
  atx_3_compatible          boolean not null default 0,

  -- Efficiency
  efficiency_80plus         text    not null default '',   -- 'Gold', 'Platinum', 'Titanium'
  efficiency_80plus_report  text    not null default '',
  cybenetics_eta_115v       text    not null default '',
  cybenetics_eta_230v       text    not null default '',
  cybenetics_lambda_115v    text    not null default '',
  cybenetics_lambda_230v    text    not null default '',
  cybenetics_report_url     text    not null default '',

  -- Physical
  modular                   text    not null default '',   -- 'Full', 'Semi', 'Non'
  semi_passive              boolean not null default 0,
  fan_start_load_pct        text    not null default '',
  fan_size_mm               integer,
  atx_bracket               boolean not null default 0,

  -- Cable counts (connector counts, not cable descriptions)
  cable_24pin_atx_count     integer,
  cable_8pin_eps_count      integer,
  cable_pcie_6_2_count      integer,
  cable_12vhpwr_count       integer,
  cable_sata_count          integer,
  cable_peripheral_count    integer,

  oem                       text    not null default '',
  warranty_years            integer,
  remarks                   text    not null default '',
  review_by_aris            text    not null default '',
  status                    text    not null default '',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);
```

**Merge notes:**
- Single source tab, no merge needed.
- Cable columns: the source has 12 columns (6 pairs of cable description + connector count). Stored as 6 integer connector counts. Cable descriptions are descriptive text, not needed in the DB — the column name identifies the cable type.
- Cybenetics ratings stored as text (e.g., 'A+', 'A') rather than parsed numeric values for fidelity.

### 6. `ram` — 8 columns

```sql
create table if not exists ram (
  id                        text primary key,
  brand                     text    not null default '',
  model                     text    not null default '',
  memory_type               text    not null default '',   -- 'DDR4', 'DDR5'
  height_mm                 real,                          -- height including contact pins
  rgb                       boolean not null default 0,
  status                    text    not null default '',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);
```

**Merge notes:**
- Single source tab, no merge needed.
- Smallest table. `height_mm` is the critical column for the fitment engine (RAM clearance vs CPU cooler).
- No `remarks`, `last_update`, or `review_by_aris` from source.
- `status` added per convention; no source status column.

### 7. `column_help` — from ticket 05

```sql
create table if not exists column_help (
  table_name                text not null,
  column_name               text not null,
  help_text                 text not null,
  primary key (table_name, column_name)
);
```

