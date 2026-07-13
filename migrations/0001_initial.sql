-- ============================================================================
-- SFF Builder v2 — Per-part-type schema
-- Replaces the monolithic sff_parts table with 7 dedicated tables.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

create table if not exists column_help (
  table_name  text not null,
  column_name text not null,
  help_text   text not null,
  primary key (table_name, column_name)
);

-- ---------------------------------------------------------------------------
-- 1. Cases
-- ---------------------------------------------------------------------------

create table if not exists cases (
  id                        text primary key,
  seller                    text    not null default '',
  name                      text    not null default '',
  style                     text    not null default '',
  side_panel                text    not null default '',
  case_material             text    not null default '',
  length_mm                 real,
  width_mm                  real,
  height_mm                 real,
  volume_l                  real,
  footprint_cm2             real,
  weight_kg                 real,
  cpu_cooler_height_mm      real,
  gpu_length_mm             real,
  gpu_width_mm              real,
  gpu_height_mm             real,
  pcie_slots                integer,
  lp_pcie_slots             integer,
  gpu_riser                 text    not null default '',
  motherboard               text    not null default '',
  psu                       text    not null default '',
  radiator_support_raw      text    not null default '',
  radiator_120mm            boolean not null default 0,
  radiator_140mm            boolean not null default 0,
  radiator_200mm            boolean not null default 0,
  radiator_240mm            boolean not null default 0,
  radiator_280mm            boolean not null default 0,
  radiator_360mm            boolean not null default 0,
  radiator_420mm            boolean not null default 0,
  radiator_top_hat          boolean not null default 0,
  drive_2_5_max             integer,
  drive_3_5_max             integer,
  drive_5_25_max            integer,
  fan_40mm_count            integer,
  fan_60mm_count            integer,
  fan_80mm_count            integer,
  fan_92mm_count            integer,
  fan_120mm_count           integer,
  fan_140mm_count           integer,
  fan_180mm_count           integer,
  fan_200mm_count           integer,
  usb_a_2_0_count           integer,
  usb_a_3_2_count           integer,
  usb_c_count               integer,
  jack_3_5mm                boolean not null default 0,
  price_cny                 real,
  price_usd                 real,
  sff_net_link              text    not null default '',
  status                    text    not null default '',
  availability_status       text    not null default 'available',
  last_update               text    not null default '',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);

-- ---------------------------------------------------------------------------
-- 2. GPUs
-- ---------------------------------------------------------------------------

create table if not exists gpus (
  id                        text primary key,
  brand                     text    not null default '',
  name                      text    not null default '',
  model                     text    not null default '',
  chipset                   text    not null default '',
  length_mm                 real,
  width_mm                  real,
  thickness_mm              real,
  pcie_bracket              text    not null default '',
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
  low_profile               boolean not null default 0,
  blower                    boolean not null default 0,
  remarks                   text    not null default '',
  status                    text    not null default '',
  availability_status       text    not null default 'available',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);

-- ---------------------------------------------------------------------------
-- 3. CPU Coolers
-- ---------------------------------------------------------------------------

create table if not exists cpu_coolers (
  id                        text primary key,
  brand                     text    not null default '',
  name                      text    not null default '',
  type                      text    not null default '',
  length_mm                 real,
  width_mm                  real,
  height_mm                 real,
  weight_g                  integer,
  heatsink_material         text    not null default '',
  heatpipes                 integer,
  ram_clearance_mm          real,
  block_length_mm           real,
  block_width_mm            real,
  block_height_mm           real,
  pump_speed_rpm            integer,
  pump_location             text    not null default '',
  tube_length_mm            integer,
  fan_thickness_mm          real,
  total_thickness_mm        real,
  tdp_w                     integer,
  material                  text    not null default '',
  fan_count                 integer,
  fan_size_mm               integer,
  fan_speed_rpm             integer,
  airflow_cfm               real,
  static_pressure_mmh2o     real,
  noise_dba                 real,
  rgb_12v                   boolean not null default 0,
  argb_5v                   boolean not null default 0,
  usb_2_0_header            boolean not null default 0,
  pcie_sata_power           text    not null default '',
  socket_amd_fm             boolean not null default 0,
  socket_amd_am4_am5        boolean not null default 0,
  socket_intel_775          boolean not null default 0,
  socket_intel_115x_1200    boolean not null default 0,
  socket_intel_1366         boolean not null default 0,
  socket_intel_1700_1851    boolean not null default 0,
  socket_intel_2011_2066    boolean not null default 0,
  review_by_aris            text    not null default '',
  remarks                   text    not null default '',
  status                    text    not null default '',
  availability_status       text    not null default 'available',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);

-- ---------------------------------------------------------------------------
-- 4. Fans
-- ---------------------------------------------------------------------------

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
  control_type              text    not null default '',
  voltage_v                 integer,
  bearing                   text    not null default '',
  fan_blades                integer,
  rgb_12v                   boolean not null default 0,
  argb_5v                   boolean not null default 0,
  cybenetics_phi_airflow    real,
  cybenetics_phi_static_pressure real,
  cybenetics_report_url     text    not null default '',
  review_by_aris            text    not null default '',
  remarks                   text    not null default '',
  status                    text    not null default '',
  availability_status       text    not null default 'available',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);

-- ---------------------------------------------------------------------------
-- 5. Motherboards
-- ---------------------------------------------------------------------------

create table if not exists motherboards (
  id                        text primary key,
  cpu                       text    not null default '',
  socket                    text    not null default '',
  chipset                   text    not null default '',
  brand                     text    not null default '',
  name                      text    not null default '',
  height_mm                 real,
  width_mm                  real,
  pcie_gen                  text    not null default '',
  pci_slot_count            integer,
  pcie_x1_slot_count        integer,
  pcie_x4_slot_count        integer,
  pcie_x8_slot_count        integer,
  pcie_x16_slot_count       integer,
  pcie_x16_slot_position    text    not null default '',
  pcie_bifurcation          text    not null default '',
  cpu_overclock             boolean not null default 0,
  ram_overclock             boolean not null default 0,
  bios_flashback            boolean not null default 0,
  reset_cmos_button         boolean not null default 0,
  ram_slots                 integer,
  ram_type                  text    not null default '',
  ram_capacity_max_gb       integer,
  ram_speed_max_mbps        integer,
  sata_3_0_port_count       integer,
  m2_key_m_slot_count       integer,
  usb_a_2_0_ports           integer,
  usb_c_2_0_ports           integer,
  usb_a_3_2_gen1_ports      integer,
  usb_c_3_2_gen1_ports      integer,
  usb_a_3_2_gen2_ports      integer,
  usb_c_3_2_gen2_ports      integer,
  usb_c_3_2_gen2x2_ports    integer,
  usb4_ports                integer,
  thunderbolt_3_ports       integer,
  thunderbolt_4_ports       integer,
  total_usb_ports           integer,
  usb_2_0_header_count      integer,
  usb_3_2_gen1_header_count integer,
  usb_c_header_count        integer,
  lan_port_count            integer,
  lan_controller            text    not null default '',
  lan_speed_gbps            real,
  m2_key_e_wifi_bt          boolean not null default 0,
  wifi                      text    not null default '',
  wifi_module               text    not null default '',
  wifi_speed_mbps           integer,
  bluetooth                 text    not null default '',
  audio                     text    not null default '',
  optical_spdif_out         boolean not null default 0,
  jack_3_5mm_count          integer,
  displayport_count         integer,
  hdmi_count                integer,
  dvi_count                 integer,
  vga                       boolean not null default 0,
  ps2_port                  boolean not null default 0,
  fan_pump_header_count     integer,
  rgb_12v_header_count      integer,
  argb_5v_header_count      integer,
  temp_sensor_header        boolean not null default 0,
  debug_led                 boolean not null default 0,
  status                    text    not null default '',
  availability_status       text    not null default 'available',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);

-- ---------------------------------------------------------------------------
-- 6. PSUs
-- ---------------------------------------------------------------------------

create table if not exists psus (
  id                        text primary key,
  brand                     text    not null default '',
  name                      text    not null default '',
  form_factor               text    not null default '',
  psu_tier                  text    not null default '',
  psu_tier_rank             real,
  psu_tier_efficiency       text    not null default '',
  wattage                   integer,
  ac_input_voltage_v        integer,
  atx_3_compatible          boolean not null default 0,
  efficiency_80plus         text    not null default '',
  efficiency_80plus_report  text    not null default '',
  cybenetics_eta_115v       text    not null default '',
  cybenetics_eta_230v       text    not null default '',
  cybenetics_lambda_115v    text    not null default '',
  cybenetics_lambda_230v    text    not null default '',
  cybenetics_report_url     text    not null default '',
  modular                   text    not null default '',
  semi_passive              boolean not null default 0,
  fan_start_load_pct        text    not null default '',
  fan_size_mm               integer,
  atx_bracket               boolean not null default 0,
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
  availability_status       text    not null default 'available',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);

-- ---------------------------------------------------------------------------
-- 7. RAM
-- ---------------------------------------------------------------------------

create table if not exists ram (
  id                        text primary key,
  brand                     text    not null default '',
  model                     text    not null default '',
  memory_type               text    not null default '',
  height_mm                 real,
  rgb                       boolean not null default 0,
  status                    text    not null default '',
  availability_status       text    not null default 'available',
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);

-- ---------------------------------------------------------------------------
-- Seed data: column_help
-- ---------------------------------------------------------------------------

insert or ignore into column_help (table_name, column_name, help_text) values
('cases', 'style', 'APU = no GPU. Sandwich = GPU & MB back-to-back with riser (e.g. Dan A4-SFX). Console = GPU & MB side-by-side with riser or cases with LP slots laid horizontal/vertical similar to game consoles (e.g. Node 202/RVZ03). Reference = Tower/Cube layout without riser (e.g. SG13/NCase M1/NZXT H210). Open = Open air case/test bench. NAS = Network-Attached Storage, usually with Hot Swap drive bays for SOHO servers.'),
('cases', 'footprint_cm2', 'Approximate desk space (Length x Width)'),
('cases', 'gpu_height_mm', 'Assume 20mm per PCIe slot by default unless mentioned otherwise'),
('cases', 'motherboard', 'mSTX = 147x140mm. mITX = 170x170mm. mDTX = 203x170mm. FlexATX = 229x191mm. DTX = 203x244mm. mATX = 244x244mm. ATX = 305x244mm. SSI-CEB = 305x267mm. SSI-EEB = 305x330mm'),
('cases', 'psu', 'Flex ATX = 81.5x40.5x150mm. TFX = 85x65x175mm. SFX = 125x63.5x100mm. SFX-L = 125x63.5x130mm. ATX = 150x86x140-200mm');
